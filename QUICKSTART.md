# Quick Start Guide

## Installation in 3 Steps

### Step 1: Extract Files
Extract the `okta-extension` folder to a location on your computer.

### Step 2: Load into Chrome
1. Open Chrome and go to: `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `okta-extension` folder

### Step 3: Start Using
1. Log into your Okta admin console
2. Navigate to any group page
3. Click the extension icon in Chrome toolbar
4. Choose an operation and run it!

## First Use Example

**Remove all deprovisioned (deactivated) users from a group:**

1. Go to: `https://your-domain.okta.com/admin/group/YOUR_GROUP_ID`
2. Click the "Okta Group Manager" extension icon
3. Verify the group name is correct
4. Click "Run Operation" under "Remove Deprovisioned Users"
5. Watch the progress and review results

That's it! The extension will:
- Load all group members (with pagination)
- Filter for deprovisioned users
- Remove them one by one
- Show you detailed results

## Tips

- **Pin the extension** to your toolbar for easy access
- **Check results** after each operation in the Results section
- **Use Custom Filter** to list users before removing them
- **Monitor progress** with the progress bar at the bottom

## Common Use Cases

### 1. Clean up deprovisioned users (deactivated accounts)
Status: DEPROVISIONED | Action: Remove from Group

### 2. Find suspended users
Status: SUSPENDED | Action: List Only

### 3. Remove staged/incomplete accounts
Status: STAGED | Action: Remove from Group

### 4. Find users pending password reset
Status: RECOVERY | Action: List Only

### 5. Audit active members
Status: ACTIVE | Action: List Only

## Need Help?

Check the full README.md for:
- Detailed feature documentation
- Troubleshooting guide
- API documentation links
- Security considerations
