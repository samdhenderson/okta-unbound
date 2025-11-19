# Frequently Asked Questions (FAQ)

Common questions and answers about Okta Unbound.

## General Questions

### What is Okta Unbound?

Okta Unbound is a Chrome extension that helps Okta administrators manage groups and users efficiently. It provides bulk operations, security analysis, audit trails, and other tools to streamline Okta administration.

### Is it officially supported by Okta?

No, Okta Unbound is an unofficial community tool not affiliated with, endorsed by, or supported by Okta, Inc. Use at your own discretion.

### Is it free?

Yes, Okta Unbound is completely free and open-source under the MIT License.

### Does it work with other browsers?

Currently, it's designed for Chrome and Chromium-based browsers. Firefox support may be added in the future.

## Installation & Setup

### How do I install the extension?

See the [Getting Started Guide](guides/Getting-Started.md) for detailed installation instructions.

### Do I need an API token?

No! Okta Unbound uses your existing Okta browser session. No API tokens are required.

### What permissions does it need?

The extension requires:
- **activeTab** - Access the current Okta page
- **scripting** - Make authenticated API calls
- **storage** - Store preferences and audit logs
- **host_permissions** - Access Okta domains (okta.com, oktapreview.com, okta-emea.com)

### Why can't I see the extension on non-Okta pages?

The extension only activates on Okta domain pages for security reasons.

## Usage Questions

### How does authentication work?

The extension uses your existing Okta browser session to make API requests. This means:
- No API tokens needed
- No additional authentication required
- All requests made with your current permissions
- Works with SSO and MFA sessions

### Can I undo an operation?

No, operations are immediate and cannot be undone. This is why confirmation modals are shown before destructive operations.

**Best Practice**: Use "List Only" mode first to preview results before removing users.

### How do I know how many API requests an operation will make?

Hover over action buttons or review confirmation modals to see API cost estimates. The extension calculates estimates based on group size and operation type.

### What happens if an operation fails?

- The extension stops the operation
- Shows detailed error messages
- Logs partial results to the Audit tab
- Users already processed are NOT rolled back

### Can I cancel a long-running operation?

Yes! Click the "Cancel Operation" button that appears during execution. The operation will stop gracefully after completing the current user.

### How long are groups cached?

- Group list: 30 minutes
- Group member counts: 10 minutes
- Group rules: 5 minutes
- Security scan results: 24 hours

You can manually refresh cached data using the refresh buttons.

## Multi-Group Operations

### How many groups can I select at once?

There's no hard limit, but for performance and API rate limiting reasons, we recommend:
- Up to 50 groups for most operations
- Up to 100 groups for lightweight operations (exports, searches)

### What are Group Collections?

Group Collections let you save frequently-used sets of groups for quick access. For example, you could create a "Sales Teams" collection containing all sales-related groups.

### Can I compare more than 2 groups?

Yes, you can compare up to 5 groups. The Venn diagram is only available for 2-group comparisons, but the overlap analysis table works for all.

## Security & Compliance

### Where is data stored?

All data (audit logs, collections, cached data) is stored locally in your browser using Chrome's storage API and IndexedDB. Nothing is sent to external servers.

### How long are audit logs kept?

By default, audit logs are kept for 90 days. You can configure retention periods in Settings:
- 30 days
- 60 days
- 90 days (default)
- 180 days
- 365 days

Old logs are automatically cleaned up.

### Can I export audit logs?

Yes! Navigate to the Audit tab and click "Export to CSV" to download all audit logs.

### Is this SOC2 compliant?

The extension provides audit logging features that help meet SOC2 requirements, but compliance depends on your organization's specific requirements and how you use the tool.

### Can audit logging be disabled?

Yes, you can disable audit logging in Settings. However, we recommend keeping it enabled for compliance and troubleshooting.

## Permissions & Access

### What Okta permissions do I need?

You need Okta administrator permissions to:
- **Read Operations**: View groups, view group members, view rules
- **Write Operations**: Remove users from groups, modify group rules

The extension respects your Okta permissions.

### Why do I get "Permission Denied" errors?

This usually means:
1. Your Okta admin role doesn't have the required permissions
2. You're trying to modify a built-in or app-managed group
3. Your session expired

Check your Okta admin role and group type.

### Can I use this with readonly admin access?

Yes! You can use all read-only features:
- Dashboard analytics
- Security scanning (view only)
- Export operations
- Rule inspection
- User searches

Write operations (removing users) require appropriate permissions.

## Performance & API Limits

### How does it handle large groups?

The extension uses smart pagination to handle groups of any size. It's been tested with groups containing 10,000+ members.

### Will I hit API rate limits?

The extension includes built-in rate limiting:
- 100ms delay between user removals
- 200ms delay between batch requests
- 500ms delay between bulk group operations

For very large operations, you may still hit limits. The extension will retry automatically.

### How can I make it faster?

- Use caching effectively (don't clear cache unnecessarily)
- Run operations during off-peak hours
- Use bulk operations instead of single-group operations when possible

### Why is the security scan slow?

Security scans analyze user activity and memberships, which requires multiple API calls per user. For large groups (1000+ members), scans can take several minutes. Results are cached for 24 hours.

## Troubleshooting

### The extension doesn't detect my group

Make sure you're on a group detail page. The URL should contain:
- `/admin/group/{groupId}` or
- `/groups/{groupId}`

### API requests are failing

Common causes:
1. **Session Expired** - Log out and log back into Okta
2. **Insufficient Permissions** - Check your Okta admin role
3. **CORS Issues** - Try refreshing the page
4. **Rate Limiting** - Wait a few minutes and try again

### The sidebar is blank

Try:
1. Refresh the Okta page
2. Check browser console for errors (F12)
3. Reload the extension in `chrome://extensions/`
4. Clear extension storage in Settings

### Operations are stuck

1. Click "Cancel Operation" if available
2. Reload the extension
3. Check the Audit tab for partial results
4. Try the operation again on a smaller group

For more troubleshooting, see the [Troubleshooting Guide](guides/Troubleshooting.md).

## Development & Contributing

### Can I contribute to the project?

Yes! We welcome contributions. See the [Contributing Guide](../CONTRIBUTING.md) for details.

### How do I report a bug?

[Open an issue](https://github.com/samdhenderson/okta-unbound/issues/new?template=bug_report.md) on GitHub with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots if applicable
- Browser console errors

### How do I request a feature?

[Open a feature request](https://github.com/samdhenderson/okta-unbound/issues/new?template=feature_request.md) on GitHub describing:
- The problem you're trying to solve
- Your proposed solution
- Why it would benefit other users

### Where's the source code?

The project is open-source on GitHub: [samdhenderson/okta-unbound](https://github.com/samdhenderson/okta-unbound)

## Feature-Specific Questions

### What's the difference between Smart Cleanup and Custom Filter?

- **Smart Cleanup** - Automatically removes DEPROVISIONED, SUSPENDED, and LOCKED_OUT users in one operation
- **Custom Filter** - Lets you choose a specific status and action (list or remove)

### How accurate is rule-based attribution?

The extension uses a heuristic algorithm to determine if users were added via rules. It's highly accurate (90%+) but not 100% certain. See [Features](Features.md#user-operations) for details.

### Can I schedule operations?

Not yet, but it's on the roadmap! You can manually run operations and save Group Collections for quick re-execution.

### Does it support nested groups?

Okta doesn't support nested groups, so neither does the extension.

## Still Have Questions?

- Check the [full documentation](Home.md)
- Review the [Troubleshooting Guide](guides/Troubleshooting.md)
- [Open an issue](https://github.com/samdhenderson/okta-unbound/issues) on GitHub

[← Back to Home](Home.md)
