# Okta Unbound

Advanced group, user, and application management for Okta administrators.

A Chrome Extension (Manifest V3) with side panel UI that provides powerful bulk operations, intelligent filtering, and automated cleanup tools for Okta administration.



#### Dev Note

This chrome extension was developed in between me and Anthropic's Claude model. It's likely that cleanup will be needed throughout. And it's likely unused, or redundant code exists.

## Features

### Overview Tab
Context-aware insights based on the current Okta page:
- Automatic detection of group, user, app, and admin pages
- Quick stats and relevant actions for each context
- Recent activity from audit logs

### Groups Tab
Hybrid search and bulk operations:
- **Live Mode**: Real-time API search with instant results
- **Cached Mode**: Load all groups once, then filter by type, size, staleness
- Multi-select with bulk operations (remove inactive users, export, security scans)
- Group collections for frequently-used sets
- Compare 2-5 groups with Venn diagram visualization

### Users Tab
User search and membership analysis:
- Search by email, name, or login
- Comprehensive user profile display
- Group membership with type detection (RULE_BASED, DIRECT, APP_GROUP)
- Rule attribution analysis

### Apps Tab
Application assignment management:
- **Browse**: Hybrid search with enrichment (assignment counts per app)
- **Convert & Copy**: Convert user assignments to group assignments
- **Bulk Assign**: Assign groups to apps or apps to groups in bulk

### Rules Tab
Group rules inspection:
- Load and cache all group rules
- Conflict detection between rules
- Rule condition parsing and display

### Security Tab
Security posture analysis based on Okta ISPM best practices:
- Orphaned accounts detection
- Users who never logged in
- Inactive users (90+ and 180+ days)
- Stale membership analysis
- Security scoring (0-100) with remediation options

### History Tab
Complete audit trail for compliance:
- Logs all administrative operations
- Configurable retention (30-365 days)
- Export to CSV for reporting
- Undo/redo support for reversible operations

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/samdhenderson/okta-unbound.git
   cd okta-unbound
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder

## Usage

1. Log into your Okta admin console
2. Click the Okta Unbound icon to open the side panel
3. The extension automatically detects your current context (group, user, app)
4. Use the tabs to access different functionality

## Development

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## Technology Stack

- TypeScript
- React 19
- Vite
- Vitest
- Chrome Extension Manifest V3

## Security

- Uses session-based authentication (no stored credentials)
- All API calls use your existing Okta session
- XSRF token extracted from DOM per request
- No data sent to external servers

## License

MIT License - see [LICENSE](LICENSE) for details.

## Disclaimer

This is an unofficial tool not affiliated with, endorsed by, or supported by Okta, Inc.
