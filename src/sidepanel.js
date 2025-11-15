// Sidepanel JavaScript for Okta Unbound Extension
// Handles all UI interactions, API calls, and feature orchestration

// =======================
// DOM Element References
// =======================
const connectionStatus = document.getElementById('connectionStatus');
const groupName = document.getElementById('groupName');
const groupId = document.getElementById('groupId');

// Tab elements
const tabButtons = document.querySelectorAll('.tab-button');
const operationsTab = document.getElementById('operationsTab');
const rulesTab = document.getElementById('rulesTab');

// Operation buttons
const removeDeactivatedBtn = document.getElementById('removeDeactivated');
const smartCleanupBtn = document.getElementById('smartCleanup');
const customFilterBtn = document.getElementById('customFilter');
const exportBtn = document.getElementById('exportBtn');

// Operation inputs
const statusFilter = document.getElementById('statusFilter');
const actionSelect = document.getElementById('action');
const exportFormat = document.getElementById('exportFormat');
const exportFilter = document.getElementById('exportFilter');

// Results and progress
const resultsBox = document.getElementById('results');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// Modal elements
const confirmModal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalApiCost = document.getElementById('modalApiCost');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel = document.getElementById('modalCancel');
const modalClose = document.getElementById('modalClose');

// Rule Inspector elements
const fetchRulesBtn = document.getElementById('fetchRules');
const refreshRulesBtn = document.getElementById('refreshRules');
const ruleSearchInput = document.getElementById('ruleSearch');
const ruleStats = document.getElementById('ruleStats');
const totalRulesEl = document.getElementById('totalRules');
const activeRulesEl = document.getElementById('activeRules');
const inactiveRulesEl = document.getElementById('inactiveRules');
const conflictingRulesEl = document.getElementById('conflictingRules');
const rulesContainer = document.getElementById('rulesContainer');

// =======================
// Global State
// =======================
let currentGroupId = null;
let currentGroupName = null;
let oktaDomain = null;
let pendingOperation = null;

// =======================
// Initialization
// =======================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Sidepanel] DOMContentLoaded - Initializing sidepanel');
  setupTabSwitching();
  setupModalHandlers();
  await initializeGroupContext();
  console.log('[Sidepanel] Initialization complete');
});

// =======================
// Tab Switching
// =======================
function setupTabSwitching() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.dataset.tab;

      // Update button states
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // Update tab content
      operationsTab.classList.remove('active');
      rulesTab.classList.remove('active');

      if (targetTab === 'operations') {
        operationsTab.classList.add('active');
      } else if (targetTab === 'rules') {
        rulesTab.classList.add('active');
      }
    });
  });
}

// =======================
// Modal Management
// =======================
function setupModalHandlers() {
  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);

  modalConfirm.addEventListener('click', () => {
    if (pendingOperation) {
      closeModal();
      executePendingOperation();
    }
  });

  // Close modal on outside click
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
      closeModal();
    }
  });
}

function showConfirmation(title, message, apiCost, operation) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalApiCost.textContent = apiCost;
  pendingOperation = operation;
  confirmModal.classList.remove('hidden');
}

function closeModal() {
  confirmModal.classList.add('hidden');
  pendingOperation = null;
}

function executePendingOperation() {
  if (pendingOperation && typeof pendingOperation === 'function') {
    pendingOperation();
  }
  pendingOperation = null;
}

// =======================
// Group Context Initialization
// =======================
async function initializeGroupContext() {
  try {
    console.log('[Sidepanel] Initializing group context...');
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    console.log('[Sidepanel] Active tab:', {
      id: tab?.id,
      url: tab?.url,
      title: tab?.title,
      status: tab?.status
    });

    if (!tab.url || !(
      tab.url.includes('okta.com') ||
      tab.url.includes('oktapreview.com') ||
      tab.url.includes('okta-emea.com')
    )) {
      console.warn('[Sidepanel] Not on an Okta page');
      showConnectionError('Please navigate to an Okta page');
      return;
    }

    oktaDomain = new URL(tab.url).origin;
    console.log('[Sidepanel] Okta domain detected:', oktaDomain);

    console.log('[Sidepanel] Sending getGroupInfo message to tab', tab.id);
    const result = await chrome.tabs.sendMessage(tab.id, { action: 'getGroupInfo' });
    console.log('[Sidepanel] Received response:', result);

    if (result.success) {
      currentGroupId = result.groupId;
      currentGroupName = result.groupName;
      console.log('[Sidepanel] Group detected:', { id: currentGroupId, name: currentGroupName });
      displayGroupInfo(result);
      updateConnectionStatus('connected');
    } else {
      console.error('[Sidepanel] Failed to get group info:', result.error);
      showConnectionError(result.error || 'Could not detect group page');
    }
  } catch (error) {
    console.error('[Sidepanel] Error initializing:', error);
    showConnectionError('Error initializing: ' + error.message);
  }
}

function displayGroupInfo(info) {
  groupName.textContent = info.groupName || 'Unknown Group';
  groupId.textContent = `ID: ${info.groupId}`;
}

function updateConnectionStatus(status) {
  connectionStatus.classList.remove('connected', 'error');

  if (status === 'connected') {
    connectionStatus.classList.add('connected');
    connectionStatus.querySelector('.status-text').textContent = 'Connected';
  } else if (status === 'error') {
    connectionStatus.classList.add('error');
    connectionStatus.querySelector('.status-text').textContent = 'Disconnected';
  }
}

function showConnectionError(message) {
  groupName.textContent = 'Not Connected';
  groupId.textContent = message;
  updateConnectionStatus('error');
  disableAllOperations();
}

function disableAllOperations() {
  removeDeactivatedBtn.disabled = true;
  smartCleanupBtn.disabled = true;
  customFilterBtn.disabled = true;
  exportBtn.disabled = true;
  fetchRulesBtn.disabled = true;
}

// Continue in next part...

// =======================
// UI Update Functions
// =======================
function updateProgress(current, total, message) {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  progressBar.style.width = percentage + '%';
  progressText.textContent = message || 'Processing ' + current + ' of ' + total;
}

function addResult(message, type) {
  type = type || 'info';
  const resultItem = document.createElement('div');
  resultItem.className = 'result-item result-' + type;
  resultItem.textContent = message;

  if (resultsBox.querySelector('.muted')) {
    resultsBox.innerHTML = '';
  }

  resultsBox.insertBefore(resultItem, resultsBox.firstChild);
}

// =======================
// API Communication Functions
// =======================
async function makeOktaRequest(endpoint, method, body) {
  method = method || 'GET';
  console.log('[Sidepanel] Making Okta request:', { endpoint, method, hasBody: !!body });

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  console.log('[Sidepanel] Sending API request to tab:', tab.id);

  const response = await chrome.tabs.sendMessage(tab.id, {
    action: 'makeApiRequest',
    endpoint: endpoint,
    method: method,
    body: body
  });

  console.log('[Sidepanel] API response received:', {
    success: response.success,
    status: response.status,
    hasData: !!response.data
  });

  return response;
}

async function getGroupDetails(groupId) {
  return makeOktaRequest('/api/v1/groups/' + groupId);
}

async function getAllGroupMembers(groupId) {
  let allMembers = [];
  let nextUrl = '/api/v1/groups/' + groupId + '/users?limit=200';
  let pageCount = 0;

  while (nextUrl) {
    pageCount++;
    const response = await makeOktaRequest(nextUrl);

    if (!response.success) {
      throw new Error(response.error || 'Failed to fetch group members');
    }

    const pageSize = response.data.length;
    allMembers = allMembers.concat(response.data);

    addResult('Page ' + pageCount + ': Loaded ' + pageSize + ' members (Total: ' + allMembers.length + ')', 'info');

    nextUrl = null;

    if (response.headers && response.headers.link) {
      const linkHeader = response.headers.link;
      const links = linkHeader.split(',').map(function(link) { return link.trim(); });

      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        if (link.includes('rel="next"')) {
          const match = link.match(/<([^>]+)>/);
          if (match) {
            const fullUrl = match[1];
            const url = new URL(fullUrl);
            nextUrl = url.pathname + url.search;
            break;
          }
        }
      }
    }

    updateProgress(allMembers.length, allMembers.length, 'Loaded ' + allMembers.length + ' members...');

    if (nextUrl) {
      await new Promise(function(resolve) { setTimeout(resolve, 100); });
    }
  }

  addResult('Pagination complete: ' + pageCount + ' pages, ' + allMembers.length + ' total members', 'success');
  return allMembers;
}

async function removeUserFromGroup(groupId, userId) {
  const response = await makeOktaRequest(
    '/api/v1/groups/' + groupId + '/users/' + userId,
    'DELETE'
  );

  if (!response.success && response.status === 403) {
    return {
      success: false,
      status: 403,
      error: '403 Forbidden - Group may be APP_GROUP type, insufficient permissions, or membership controlled by rules'
    };
  }

  return response;
}

// =======================
// API Cost Estimation
// =======================
function estimateApiCost(operation, userCount) {
  switch (operation) {
    case 'removeDeactivated':
    case 'smartCleanup':
    case 'customFilter':
      const fetchCost = '1-5 requests (pagination)';
      const removalCost = userCount ? userCount + ' requests (1 per user)' : 'Variable (depends on matches)';
      const total = userCount ? 'Approximately ' + (userCount + 5) + ' requests' : '1-50 requests';
      return 'Fetch members: ' + fetchCost + '\nRemove users: ' + removalCost + '\nTotal: ' + total;

    case 'export':
      return 'Fetch members: 1-5 requests (pagination, read-only)\nNo modifications made';

    case 'fetchRules':
      return 'Fetch all rules: 1-2 requests (read-only)';

    default:
      return 'Cost estimate not available';
  }
}

// =======================
// Operation Handlers
// =======================

// Remove Deprovisioned Users
removeDeactivatedBtn.addEventListener('click', function() {
  if (!currentGroupId) {
    addResult('No group detected', 'error');
    return;
  }

  showConfirmation(
    'Remove Deprovisioned Users',
    'This will scan all group members and remove users with DEPROVISIONED status. This action cannot be undone.',
    estimateApiCost('removeDeactivated'),
    handleRemoveDeactivated
  );
});

async function handleRemoveDeactivated() {
  try {
    disableButtons(true);
    addResult('Starting operation: Remove deprovisioned users', 'info');

    addResult('Checking group type and permissions...', 'info');
    const groupDetails = await getGroupDetails(currentGroupId);

    if (groupDetails.success && groupDetails.data) {
      const groupType = groupDetails.data.type;
      addResult('Group type: ' + groupType, 'info');

      if (groupType === 'APP_GROUP') {
        addResult('WARNING: Cannot modify APP_GROUP. Members managed by source directory.', 'error');
        updateProgress(0, 100, 'Cannot modify APP_GROUP');
        return;
      }

      if (groupType === 'BUILT_IN') {
        addResult('WARNING: BUILT_IN group. Membership modification may be restricted.', 'warning');
      }
    }

    updateProgress(0, 100, 'Loading group members...');

    const members = await getAllGroupMembers(currentGroupId);
    addResult('Found ' + members.length + ' total members', 'info');

    const deprovisionedUsers = members.filter(function(user) { return user.status === 'DEPROVISIONED'; });
    addResult('Found ' + deprovisionedUsers.length + ' deprovisioned users', 'warning');

    if (deprovisionedUsers.length === 0) {
      addResult('No deprovisioned users to remove', 'success');
      updateProgress(100, 100, 'Complete');
      return;
    }

    let removed = 0;
    let failed = 0;
    let forbiddenCount = 0;

    for (let i = 0; i < deprovisionedUsers.length; i++) {
      const user = deprovisionedUsers[i];
      updateProgress(i + 1, deprovisionedUsers.length, 'Removing user ' + (i + 1) + ' of ' + deprovisionedUsers.length);

      const result = await removeUserFromGroup(currentGroupId, user.id);

      if (result.success) {
        removed++;
        addResult('Removed: ' + user.profile.login + ' (' + user.profile.firstName + ' ' + user.profile.lastName + ')', 'success');
      } else {
        failed++;
        if (result.status === 403) {
          forbiddenCount++;
          addResult('403 Forbidden: ' + user.profile.login + ' - ' + result.error, 'error');

          if (forbiddenCount === 1) {
            addResult('Stopping after first 403 to avoid log spam', 'warning');
            addResult('Remaining ' + (deprovisionedUsers.length - i - 1) + ' users not attempted', 'warning');
            break;
          }
        } else {
          addResult('Failed: ' + user.profile.login + ' - ' + (result.error || 'Unknown error'), 'error');
        }
      }

      await new Promise(function(resolve) { setTimeout(resolve, 100); });
    }

    addResult('Operation complete: ' + removed + ' removed, ' + failed + ' failed', removed > 0 ? 'success' : 'warning');
    updateProgress(100, 100, 'Complete');

  } catch (error) {
    addResult('Error: ' + error.message, 'error');
    updateProgress(0, 100, 'Error occurred');
  } finally {
    disableButtons(false);
  }
}

// Smart Cleanup
smartCleanupBtn.addEventListener('click', function() {
  if (!currentGroupId) {
    addResult('No group detected', 'error');
    return;
  }

  showConfirmation(
    'Smart Cleanup',
    'This will remove all inactive users (DEPROVISIONED, SUSPENDED, LOCKED_OUT) in one operation. This action cannot be undone.',
    estimateApiCost('smartCleanup'),
    handleSmartCleanup
  );
});

async function handleSmartCleanup() {
  try {
    disableButtons(true);
    addResult('Starting Smart Cleanup: Removing inactive users', 'info');

    const groupDetails = await getGroupDetails(currentGroupId);
    if (groupDetails.success && groupDetails.data && groupDetails.data.type === 'APP_GROUP') {
      addResult('WARNING: Cannot modify APP_GROUP', 'error');
      return;
    }

    const members = await getAllGroupMembers(currentGroupId);
    const inactiveStatuses = ['DEPROVISIONED', 'SUSPENDED', 'LOCKED_OUT'];
    const inactiveUsers = members.filter(function(user) { return inactiveStatuses.includes(user.status); });

    addResult('Found ' + inactiveUsers.length + ' inactive users', 'warning');

    if (inactiveUsers.length === 0) {
      addResult('No inactive users to remove', 'success');
      updateProgress(100, 100, 'Complete');
      return;
    }

    inactiveStatuses.forEach(function(status) {
      const count = inactiveUsers.filter(function(u) { return u.status === status; }).length;
      if (count > 0) {
        addResult('- ' + status + ': ' + count + ' users', 'info');
      }
    });

    let removed = 0;
    let failed = 0;

    for (let i = 0; i < inactiveUsers.length; i++) {
      const user = inactiveUsers[i];
      const result = await removeUserFromGroup(currentGroupId, user.id);

      if (result.success) {
        removed++;
        addResult('Removed: ' + user.profile.login + ' (' + user.status + ')', 'success');
      } else {
        failed++;
        addResult('Failed: ' + user.profile.login, 'error');
        if (result.status === 403) break;
      }

      await new Promise(function(resolve) { setTimeout(resolve, 100); });
    }

    addResult('Smart Cleanup complete: ' + removed + ' removed, ' + failed + ' failed', 'success');
    updateProgress(100, 100, 'Complete');

  } catch (error) {
    addResult('Error: ' + error.message, 'error');
  } finally {
    disableButtons(false);
  }
}

function disableButtons(disabled) {
  removeDeactivatedBtn.disabled = disabled;
  smartCleanupBtn.disabled = disabled;
  customFilterBtn.disabled = disabled;
  exportBtn.disabled = disabled;
}

// Custom Filter
customFilterBtn.addEventListener('click', function() {
  if (!currentGroupId) {
    addResult('No group detected', 'error');
    return;
  }

  const targetStatus = statusFilter.value;
  const action = actionSelect.value;

  showConfirmation(
    'Custom Filter',
    action === 'remove' ?
      'This will remove all users with status: ' + targetStatus + '. This action cannot be undone.' :
      'This will list all users with status: ' + targetStatus,
    estimateApiCost('customFilter'),
    async function() { await handleCustomFilter(targetStatus, action); }
  );
});

async function handleCustomFilter(targetStatus, action) {
  try {
    disableButtons(true);
    addResult('Starting: ' + (action === 'remove' ? 'Remove' : 'List') + ' users with status ' + targetStatus, 'info');

    const members = await getAllGroupMembers(currentGroupId);
    const filteredUsers = members.filter(function(user) { return user.status === targetStatus; });

    addResult('Found ' + filteredUsers.length + ' users with status ' + targetStatus, 'warning');

    if (filteredUsers.length === 0) {
      addResult('No users with status ' + targetStatus, 'success');
      updateProgress(100, 100, 'Complete');
      return;
    }

    if (action === 'list') {
      filteredUsers.forEach(function(user) {
        addResult(user.profile.login + ' - ' + user.profile.firstName + ' ' + user.profile.lastName, 'info');
      });
      addResult('Listed ' + filteredUsers.length + ' users', 'success');
    } else {
      let removed = 0;
      for (let i = 0; i < filteredUsers.length; i++) {
        const user = filteredUsers[i];
        const result = await removeUserFromGroup(currentGroupId, user.id);
        if (result.success) {
          removed++;
          addResult('Removed: ' + user.profile.login, 'success');
        }
        await new Promise(function(resolve) { setTimeout(resolve, 100); });
      }
      addResult('Removed ' + removed + ' users', 'success');
    }

    updateProgress(100, 100, 'Complete');
  } catch (error) {
    addResult('Error: ' + error.message, 'error');
  } finally {
    disableButtons(false);
  }
}

// Export
exportBtn.addEventListener('click', function() {
  if (!currentGroupId) {
    addResult('No group detected', 'error');
    return;
  }

  const format = exportFormat.value;
  const statusFilterValue = exportFilter.value;

  showConfirmation(
    'Export Group Members',
    'This will export group members to ' + format.toUpperCase() + ' format' +
      (statusFilterValue ? ' (filtered by ' + statusFilterValue + ')' : ''),
    estimateApiCost('export'),
    async function() { await handleExport(format, statusFilterValue); }
  );
});

async function handleExport(format, statusFilterValue) {
  try {
    disableButtons(true);
    addResult('Starting export: ' + format.toUpperCase() + ' format', 'info');

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'exportGroupMembers',
      groupId: currentGroupId,
      groupName: currentGroupName || 'group',
      format: format,
      statusFilter: statusFilterValue
    });

    if (response.success) {
      addResult('Export complete: ' + response.count + ' members exported', 'success');
      updateProgress(100, 100, 'Complete');
    } else {
      addResult('Export failed: ' + (response.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    addResult('Error: ' + error.message, 'error');
  } finally {
    disableButtons(false);
  }
}

// =======================
// Rule Inspector Handlers
// =======================
fetchRulesBtn.addEventListener('click', function() {
  showConfirmation(
    'Load Group Rules',
    'This will fetch all group rules from your Okta organization for analysis.',
    estimateApiCost('fetchRules'),
    handleFetchRules
  );
});

async function handleFetchRules() {
  try {
    fetchRulesBtn.disabled = true;
    rulesContainer.innerHTML = '<p class="loading">Loading rules...</p>';

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'fetchGroupRules'
    });

    if (response.success) {
      displayRules(response.rules);
      displayRuleStats(response.stats);
      refreshRulesBtn.classList.remove('hidden');
      setupRuleSearch(response.rules);
    } else {
      rulesContainer.innerHTML = '<p class="error">Failed to load rules: ' + response.error + '</p>';
    }
  } catch (error) {
    rulesContainer.innerHTML = '<p class="error">Error: ' + error.message + '</p>';
  } finally {
    fetchRulesBtn.disabled = false;
  }
}

function displayRuleStats(stats) {
  totalRulesEl.textContent = stats.total;
  activeRulesEl.textContent = stats.active;
  inactiveRulesEl.textContent = stats.inactive;
  conflictingRulesEl.textContent = stats.conflicts;
  ruleStats.classList.remove('hidden');
}

function displayRules(rules) {
  if (!rules || rules.length === 0) {
    rulesContainer.innerHTML = '<p class="muted">No rules found</p>';
    return;
  }

  rulesContainer.innerHTML = '';

  rules.forEach(function(rule) {
    const ruleCard = createRuleCard(rule);
    rulesContainer.appendChild(ruleCard);
  });
}

function createRuleCard(rule) {
  const card = document.createElement('div');
  card.className = 'rule-card';

  const header = document.createElement('div');
  header.className = 'rule-header';

  const name = document.createElement('div');
  name.className = 'rule-name';
  name.textContent = rule.name;

  const status = document.createElement('span');
  status.className = 'rule-status ' + rule.status.toLowerCase();
  status.textContent = rule.status;

  header.appendChild(name);
  header.appendChild(status);

  const details = document.createElement('div');
  details.className = 'rule-details';
  details.innerHTML = '<strong>ID:</strong> ' + rule.id;

  const condition = document.createElement('div');
  condition.className = 'rule-condition';
  condition.textContent = rule.condition || 'No condition';

  card.appendChild(header);
  card.appendChild(details);
  card.appendChild(condition);

  return card;
}

function setupRuleSearch(rules) {
  ruleSearchInput.addEventListener('input', function() {
    const query = ruleSearchInput.value.toLowerCase();
    const filtered = rules.filter(function(rule) {
      return rule.name.toLowerCase().includes(query) ||
             rule.id.toLowerCase().includes(query) ||
             (rule.condition || '').toLowerCase().includes(query);
    });
    displayRules(filtered);
  });
}

refreshRulesBtn.addEventListener('click', handleFetchRules);

console.log('Okta Unbound sidepanel initialized');
