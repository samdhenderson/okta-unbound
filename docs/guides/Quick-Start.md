# Quick Start Guide

Get Okta Unbound running in under 5 minutes.

## Installation in 3 Steps

### Step 1: Build the Extension

```bash
git clone https://github.com/samdhenderson/okta-unbound.git
cd okta-unbound
npm install
npm run build
```

### Step 2: Load into Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `okta-unbound/dist` folder

### Step 3: Start Using

1. Log into your Okta admin console
2. Navigate to any group page
3. Click the Okta Unbound icon in Chrome toolbar
4. Choose an operation and run it!

## First Use Example

**Remove all deprovisioned (deactivated) users from a group:**

1. Go to: `https://your-domain.okta.com/admin/group/YOUR_GROUP_ID`
2. Click the Okta Unbound extension icon
3. Navigate to the Operations tab
4. Click "Run Operation" under "Remove Deprovisioned Users"
5. Confirm the operation
6. Watch the progress and review results

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
**Operations Tab** → Remove Deprovisioned Users → Run Operation

### 2. Find suspended users
**Operations Tab** → Custom Filter:
- Status: SUSPENDED
- Action: List Only
- Click "Run Custom Filter"

### 3. Remove staged/incomplete accounts
**Operations Tab** → Custom Filter:
- Status: STAGED
- Action: Remove from Group
- Click "Run Custom Filter"

### 4. Security audit
**Security Tab** → Run Security Scan → Review Findings

### 5. Find a user across all groups
**Groups Tab** → Find User → Enter email → Search

## Next Steps

### Learn More Features

- [Full Getting Started Guide](Getting-Started.md) - Detailed setup
- [Usage Guide](Usage-Guide.md) - Step-by-step examples
- [Features](../Features.md) - Complete feature documentation

### Advanced Operations

- [Multi-Group Operations](Multi-Group-Operations.md) - Bulk operations on multiple groups
- [Security Analysis](Security-Analysis.md) - Security posture scanning
- [Audit Trail](Audit-Trail.md) - Compliance logging

## Need Help?

- Check the [Troubleshooting Guide](Troubleshooting.md)
- Review the [FAQ](../FAQ.md)
- See the full [README](../../README.md) for detailed documentation

[← Back to Home](../Home.md) | [Getting Started →](Getting-Started.md)
