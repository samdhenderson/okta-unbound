// Get references to DOM elements
const groupInfo = document.getElementById('groupInfo');
const resultsBox = document.getElementById('results');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const removeDeactivatedBtn = document.getElementById('removeDeactivated');
const customFilterBtn = document.getElementById('customFilter');
const statusFilter = document.getElementById('statusFilter');
const actionSelect = document.getElementById('action');

let currentGroupId = null;
let oktaDomain = null;

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    // Check if we're on an Okta page
    if (!tab.url.includes('okta.com') && !tab.url.includes('oktapreview.com') && !tab.url.includes('okta-emea.com')) {
      showError('Please navigate to an Okta group page');
      return;
    }

    // Extract Okta domain
    const url = new URL(tab.url);
    oktaDomain = url.origin;

    // Get group info from the page
    const result = await chrome.tabs.sendMessage(tab.id, { action: 'getGroupInfo' });

    if (result.success) {
      currentGroupId = result.groupId;
      displayGroupInfo(result);
    } else {
      showError(result.error || 'Could not detect group page');
    }
  } catch (error) {
    showError('Error initializing extension: ' + error.message);
  }
});

// Display group information
function displayGroupInfo(info) {
  groupInfo.innerHTML = `
    <p><strong>Group Name:</strong> ${info.groupName || 'Unknown'}</p>
    <p><strong>Group ID:</strong> ${info.groupId}</p>
    <p><strong>Status:</strong> <span class="success">Connected</span></p>
  `;
}

// Show error message
function showError(message) {
  groupInfo.innerHTML = `<p class="error">${message}</p>`;
  removeDeactivatedBtn.disabled = true;
  customFilterBtn.disabled = true;
}

// Update progress
function updateProgress(current, total, message) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  progressBar.style.width = percentage + '%';
  progressText.textContent = message || `Processing ${current} of ${total}`;
}

// Add result to results box
function addResult(message, type = 'info') {
  const resultItem = document.createElement('div');
  resultItem.className = `result-item result-${type}`;
  resultItem.textContent = message;

  if (resultsBox.querySelector('.muted')) {
    resultsBox.innerHTML = '';
  }

  resultsBox.insertBefore(resultItem, resultsBox.firstChild);
}

// Make API request using the existing Okta session
async function makeOktaRequest(endpoint, method = 'GET', body = null) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  const response = await chrome.tabs.sendMessage(tab.id, {
    action: 'makeApiRequest',
    endpoint: endpoint,
    method: method,
    body: body
  });

  return response;
}

// Get group information and check if it's modifiable
async function getGroupDetails(groupId) {
  const response = await makeOktaRequest(`/api/v1/groups/${groupId}`);
  return response;
}

// Get all group members with pagination
async function getAllGroupMembers(groupId) {
  let allMembers = [];
  let nextUrl = `/api/v1/groups/${groupId}/users?limit=200`;
  let pageCount = 0;

  while (nextUrl) {
    pageCount++;
    const response = await makeOktaRequest(nextUrl);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch group members');
    }

    const pageSize = response.data.length;
    allMembers = allMembers.concat(response.data);

    addResult(`Page ${pageCount}: Loaded ${pageSize} members (Total: ${allMembers.length})`, 'info');

    // Okta returns multiple Link headers (not comma-separated)
    // We need to find the one with rel="next"
    nextUrl = null;

    if (response.headers?.link) {
      // The link header might be a single string or already parsed
      const linkHeader = response.headers.link;

      // Handle case where link header contains both self and next
      // Format: <url1>; rel="self", <url2>; rel="next"
      // OR separate headers that got combined
      const links = linkHeader.split(',').map(link => link.trim());

      for (const link of links) {
        if (link.includes('rel="next"')) {
          const match = link.match(/<([^>]+)>/);
          if (match) {
            // Extract just the path (remove domain if present)
            const fullUrl = match[1];
            const url = new URL(fullUrl);
            nextUrl = url.pathname + url.search;
            break;
          }
        }
      }
    }

    updateProgress(allMembers.length, allMembers.length, `Loaded ${allMembers.length} members...`);

    // Add a small delay to avoid rate limiting during pagination
    if (nextUrl) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  addResult(`Pagination complete: ${pageCount} pages, ${allMembers.length} total members`, 'success');
  return allMembers;
}

// Remove user from group
async function removeUserFromGroup(groupId, userId) {
  const response = await makeOktaRequest(
    `/api/v1/groups/${groupId}/users/${userId}`,
    'DELETE'
  );

  if (!response.success && response.status === 403) {
    // 403 can mean: APP_GROUP (can't modify), insufficient permissions, or group rules
    return {
      success: false,
      status: 403,
      error: '403 Forbidden - Possible causes: Group is APP_GROUP type (e.g., AD group), insufficient permissions, or group membership controlled by rules'
    };
  }

  return response;
}

// Handle remove deactivated users operation
removeDeactivatedBtn.addEventListener('click', async () => {
  if (!currentGroupId) {
    addResult('No group detected', 'error');
    return;
  }

  try {
    removeDeactivatedBtn.disabled = true;
    customFilterBtn.disabled = true;

    addResult('Starting operation: Remove deprovisioned (deactivated) users', 'info');

    // Check group details first
    addResult('Checking group type and permissions...', 'info');
    const groupDetails = await getGroupDetails(currentGroupId);

    if (groupDetails.success && groupDetails.data) {
      const groupType = groupDetails.data.type;
      addResult(`Group type: ${groupType}`, 'info');

      if (groupType === 'APP_GROUP') {
        addResult('⚠️ WARNING: This is an APP_GROUP (e.g., Active Directory). You cannot modify membership via API - members are managed by the source directory.', 'error');
        updateProgress(0, 100, 'Cannot modify APP_GROUP');
        return;
      }

      if (groupType === 'BUILT_IN') {
        addResult('⚠️ WARNING: This is a BUILT_IN group. Membership modification may be restricted.', 'warning');
      }
    }

    updateProgress(0, 100, 'Loading group members...');

    // Get all members
    const members = await getAllGroupMembers(currentGroupId);
    addResult(`Found ${members.length} total members`, 'info');

    // Filter deprovisioned users (API uses DEPROVISIONED, not DEACTIVATED)
    const deprovisionedUsers = members.filter(user => user.status === 'DEPROVISIONED');
    addResult(`Found ${deprovisionedUsers.length} deprovisioned users`, 'warning');

    if (deprovisionedUsers.length === 0) {
      addResult('No deprovisioned users to remove', 'success');
      updateProgress(100, 100, 'Complete');
      return;
    }

    // Remove each deprovisioned user
    let removed = 0;
    let failed = 0;
    let forbiddenCount = 0;

    for (let i = 0; i < deprovisionedUsers.length; i++) {
      const user = deprovisionedUsers[i];
      updateProgress(i + 1, deprovisionedUsers.length, `Removing user ${i + 1} of ${deprovisionedUsers.length}`);

      const result = await removeUserFromGroup(currentGroupId, user.id);

      console.log(`Removal attempt for ${user.profile.login}:`, result);

      if (result.success) {
        removed++;
        addResult(`✓ Removed: ${user.profile.login} (${user.profile.firstName} ${user.profile.lastName})`, 'success');
      } else {
        failed++;
        console.log(`Failed removal - Status: ${result.status}, Error: ${result.error}`);
        if (result.status === 403) {
          forbiddenCount++;
          console.log(`403 FORBIDDEN detected - forbiddenCount: ${forbiddenCount}`);
          addResult(`✗ 403 Forbidden: ${user.profile.login} - ${result.error}`, 'error');

          // Stop immediately on first 403 to avoid spamming logs
          if (forbiddenCount === 1) {
            console.log('BREAKING LOOP - First 403 detected');
            addResult(`⚠️ Stopping after first 403 Forbidden to avoid spamming logs.`, 'warning');
            addResult(`Remaining ${deprovisionedUsers.length - i - 1} users were not attempted.`, 'warning');
            addResult(`This group likely has restrictions: APP_GROUP type, group rules, or insufficient permissions.`, 'error');
            break;
          }
        } else {
          addResult(`✗ Failed: ${user.profile.login} - ${result.error || 'Unknown error'}`, 'error');
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    addResult(`Operation complete: ${removed} removed, ${failed} failed`, removed > 0 ? 'success' : 'warning');

    if (forbiddenCount > 0) {
      addResult(`⚠️ Stopped due to 403 Forbidden. Check group type, rules, and permissions before retrying.`, 'error');
    }

    updateProgress(100, 100, 'Complete');

  } catch (error) {
    addResult(`Error: ${error.message}`, 'error');
    updateProgress(0, 100, 'Error occurred');
  } finally {
    removeDeactivatedBtn.disabled = false;
    customFilterBtn.disabled = false;
  }
});

// Handle custom filter operation
customFilterBtn.addEventListener('click', async () => {
  if (!currentGroupId) {
    addResult('No group detected', 'error');
    return;
  }

  try {
    const targetStatus = statusFilter.value;
    const action = actionSelect.value;

    removeDeactivatedBtn.disabled = true;
    customFilterBtn.disabled = true;

    addResult(`Starting operation: ${action === 'remove' ? 'Remove' : 'List'} users with status ${targetStatus}`, 'info');

    // Check group details if removing
    if (action === 'remove') {
      addResult('Checking group type and permissions...', 'info');
      const groupDetails = await getGroupDetails(currentGroupId);

      if (groupDetails.success && groupDetails.data) {
        const groupType = groupDetails.data.type;
        addResult(`Group type: ${groupType}`, 'info');

        if (groupType === 'APP_GROUP') {
          addResult('⚠️ WARNING: This is an APP_GROUP (e.g., Active Directory). You cannot modify membership via API - members are managed by the source directory.', 'error');
          updateProgress(0, 100, 'Cannot modify APP_GROUP');
          return;
        }

        if (groupType === 'BUILT_IN') {
          addResult('⚠️ WARNING: This is a BUILT_IN group. Membership modification may be restricted.', 'warning');
        }
      }
    }

    updateProgress(0, 100, 'Loading group members...');

    // Get all members
    const members = await getAllGroupMembers(currentGroupId);
    addResult(`Found ${members.length} total members`, 'info');

    // Filter by status
    const filteredUsers = members.filter(user => user.status === targetStatus);
    addResult(`Found ${filteredUsers.length} users with status ${targetStatus}`, 'warning');

    if (filteredUsers.length === 0) {
      addResult(`No users with status ${targetStatus}`, 'success');
      updateProgress(100, 100, 'Complete');
      return;
    }

    if (action === 'list') {
      // Just list the users
      filteredUsers.forEach(user => {
        addResult(`${user.profile.login} - ${user.profile.firstName} ${user.profile.lastName} (${user.status})`, 'info');
      });
      addResult(`Listed ${filteredUsers.length} users`, 'success');
      updateProgress(100, 100, 'Complete');
    } else {
      // Remove users
      let removed = 0;
      let failed = 0;
      let forbiddenCount = 0;

      for (let i = 0; i < filteredUsers.length; i++) {
        const user = filteredUsers[i];
        updateProgress(i + 1, filteredUsers.length, `Removing user ${i + 1} of ${filteredUsers.length}`);

        const result = await removeUserFromGroup(currentGroupId, user.id);

        console.log(`Removal attempt for ${user.profile.login}:`, result);

        if (result.success) {
          removed++;
          addResult(`✓ Removed: ${user.profile.login} (${user.profile.firstName} ${user.profile.lastName})`, 'success');
        } else {
          failed++;
          console.log(`Failed removal - Status: ${result.status}, Error: ${result.error}`);
          if (result.status === 403) {
            forbiddenCount++;
            console.log(`403 FORBIDDEN detected - forbiddenCount: ${forbiddenCount}`);
            addResult(`✗ 403 Forbidden: ${user.profile.login} - ${result.error}`, 'error');

            // Stop immediately on first 403 to avoid spamming logs
            if (forbiddenCount === 1) {
              console.log('BREAKING LOOP - First 403 detected');
              addResult(`⚠️ Stopping after first 403 Forbidden to avoid spamming logs.`, 'warning');
              addResult(`Remaining ${filteredUsers.length - i - 1} users were not attempted.`, 'warning');
              addResult(`This group likely has restrictions: APP_GROUP type, group rules, or insufficient permissions.`, 'error');
              break;
            }
          } else {
            addResult(`✗ Failed: ${user.profile.login} - ${result.error || 'Unknown error'}`, 'error');
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      addResult(`Operation complete: ${removed} removed, ${failed} failed`, removed > 0 ? 'success' : 'warning');

      if (forbiddenCount > 0) {
        addResult(`⚠️ Stopped due to 403 Forbidden. Check group type, rules, and permissions before retrying.`, 'error');
      }

      updateProgress(100, 100, 'Complete');
    }

  } catch (error) {
    addResult(`Error: ${error.message}`, 'error');
    updateProgress(0, 100, 'Error occurred');
  } finally {
    removeDeactivatedBtn.disabled = false;
    customFilterBtn.disabled = false;
  }
});
