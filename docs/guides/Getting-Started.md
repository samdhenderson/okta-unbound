# Getting Started

Get up and running with Okta Unbound in just a few minutes.

## Table of Contents

- [System Requirements](#system-requirements)
- [Installation](#installation)
- [Initial Setup](#initial-setup)
- [First Use](#first-use)
- [Next Steps](#next-steps)

## System Requirements

### Browser

- Google Chrome (recommended) or Chromium-based browser
- Chrome version 88 or higher

### Okta Access

- Active Okta administrator account
- Permissions to:
  - View groups and group members
  - Remove users from groups (for write operations)
  - View group rules

### System

- No additional software required
- Works on Windows, macOS, and Linux

## Installation

### Method 1: Load as Unpacked Extension (Recommended)

This is the recommended method for development and testing.

**Step 1: Download the Extension**

```bash
git clone https://github.com/samdhenderson/okta-unbound.git
cd okta-unbound
npm install
npm run build
```

**Step 2: Open Chrome Extensions**

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Or click: Menu (⋮) → More Tools → Extensions

**Step 3: Enable Developer Mode**

Toggle the "Developer mode" switch in the top right corner.

**Step 4: Load the Extension**

1. Click "Load unpacked"
2. Navigate to the `okta-unbound` folder
3. Select the `dist` folder (created by `npm run build`)
4. The extension should now appear in your extensions list

**Step 5: Pin the Extension** (Optional)

1. Click the puzzle piece icon (🧩) in Chrome's toolbar
2. Find "Okta Unbound" in the list
3. Click the pin icon to keep it visible

### Method 2: Install from Chrome Web Store

Coming soon! The extension will be available on the Chrome Web Store.

### Method 3: Package as CRX (For Distribution)

If you need to distribute the extension internally:

1. In Chrome extensions page (`chrome://extensions/`)
2. Ensure Developer mode is enabled
3. Click "Pack extension"
4. Select the `dist` directory as the extension root
5. Chrome will create:
   - `.crx` file (the extension package)
   - `.pem` file (private key - keep this secure!)
6. Distribute the `.crx` file to users
7. Keep the `.pem` file secure for future updates

## Initial Setup

### 1. Grant Permissions

When you first load the extension, Chrome will ask for permissions:

- **activeTab** - Access the current Okta page
- **scripting** - Inject scripts to make API calls
- **storage** - Store extension preferences
- **host_permissions** - Access Okta domains

Click "Allow" to grant these permissions.

### 2. Configure Settings (Optional)

Click the extension icon and navigate to Settings to configure:

- **Audit Log Retention** - How long to keep audit logs (default: 90 days)
- **Cache Duration** - How long to cache data (default: 5 minutes)
- **API Rate Limiting** - Delay between API requests (default: 100ms)

### 3. Verify Installation

1. Navigate to your Okta admin console
2. Go to any group page (e.g., `https://your-domain.okta.com/admin/group/00g...`)
3. Click the Okta Unbound icon in your toolbar
4. You should see the Dashboard tab with group information

If the extension doesn't load, check the [Troubleshooting Guide](Troubleshooting.md).

## First Use

### Basic Workflow

**Step 1: Navigate to a Group**

1. Log into your Okta admin console
2. Go to Directory → Groups
3. Click on any group to open its detail page

**Step 2: Open the Extension**

Click the Okta Unbound icon in your Chrome toolbar.

**Step 3: View Dashboard**

The Dashboard tab shows:
- Group health metrics
- User status distribution
- Membership sources (direct vs rule-based)
- Recent activity
- Quick action buttons

**Step 4: Explore Features**

Navigate through the tabs:
- **Dashboard** - Overview and quick actions
- **Operations** - Bulk user operations
- **Groups** - Multi-group operations
- **Rules** - Group rule inspector
- **Security** - Security posture analysis
- **Audit** - Operation history

### First Operation: Remove Deprovisioned Users

Let's walk through a simple operation to get familiar with the extension.

**Scenario**: Remove deactivated users from a group.

1. **Navigate to a Group**
   - Go to any group in your Okta admin console
   - Example: `https://your-domain.okta.com/admin/group/00g1234567890abcdef`

2. **Open the Extension**
   - Click the Okta Unbound icon

3. **Run the Operation**
   - Go to the Operations tab
   - Find "Remove Deprovisioned Users"
   - Click "Run Operation"

4. **Review Confirmation**
   - The modal shows:
     - Number of deprovisioned users found
     - Estimated API requests
     - Warning about the operation
   - Click "Confirm" to proceed

5. **Monitor Progress**
   - Watch the progress bar
   - View detailed logs in real-time
   - Cancel if needed using "Cancel Operation" button

6. **Review Results**
   - Check the results summary:
     - Total users processed
     - Successful removals
     - Any errors
   - Results are automatically logged in the Audit tab

Congratulations! You've completed your first operation with Okta Unbound.

## Next Steps

### Learn More Features

- [Features Overview](../Features.md) - Complete feature list
- [Usage Guide](Usage-Guide.md) - Detailed usage examples
- [Multi-Group Operations](Multi-Group-Operations.md) - Bulk operations

### Configure for Your Needs

- [Security Analysis](Security-Analysis.md) - Set up security scanning
- [Audit Trail](Audit-Trail.md) - Configure compliance logging

### Advanced Topics

- [Architecture](../technical/Architecture.md) - How it works under the hood
- [API Reference](../api/API-Reference.md) - API endpoints and usage
- [Development](../technical/Development.md) - Contribute to the project

### Get Help

- [Troubleshooting](Troubleshooting.md) - Common issues and solutions
- [FAQ](../FAQ.md) - Frequently asked questions
- [GitHub Issues](https://github.com/samdhenderson/okta-unbound/issues) - Report bugs or request features

## Quick Reference Card

### Essential Keyboard Shortcuts

- **Ctrl/Cmd + K** - Quick search (coming soon)
- **Esc** - Close modals

### Common Operations

| Operation | Location | Use Case |
|-----------|----------|----------|
| Remove deprovisioned users | Operations tab | Clean up deactivated accounts |
| Smart cleanup | Operations tab | Remove all inactive users |
| Security scan | Security tab | Detect security risks |
| Find user across groups | Groups tab | Locate user memberships |
| Export members | Operations tab | Generate reports |
| View rules | Rules tab | Understand group automation |

### Status Indicators

- **🟢 Green** - Operation successful
- **🟡 Yellow** - Partial success or warning
- **🔴 Red** - Operation failed or error
- **🔵 Blue** - Information or in progress

## Tips for Success

1. **Start Small** - Test operations on small groups first
2. **Use List Only** - Preview results before removing users
3. **Check Audit Logs** - Review operation history regularly
4. **Export Reports** - Keep records of compliance actions
5. **Pin the Extension** - Keep it easily accessible
6. **Read Confirmations** - Always review API cost estimates

## Support

Need help? Here's how to get support:

1. **Check Documentation** - Most questions are answered in the wiki
2. **Search Issues** - Someone may have had the same problem
3. **Open an Issue** - Report bugs or request features on GitHub
4. **Review Console** - Check browser console for error messages

[← Back to Home](../Home.md) | [Usage Guide →](Usage-Guide.md)
