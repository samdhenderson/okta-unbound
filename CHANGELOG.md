# Changelog

All notable changes to Okta Unbound will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2024-11-15

### Added
- Sidebar UI replacing popup for better screen real estate and organization
- Tabbed navigation (Operations, Rule Inspector)
- Confirmation modals for all operations with API cost estimates
- API cost tooltips on hover (info icons next to operation buttons)
- Rule Inspector feature - analyze all group rules in organization
- Rule conflict detection - identify overlapping rule conditions
- Rule statistics display (total, active, inactive, conflicts)
- Rule search and filtering capability
- Connection status indicator in header
- Enhanced group info banner
- Background service worker improvements for sidebar management
- Notifications permission for non-Okta page warnings
- sidePanel permission for Chrome Extension

### Changed
- Migrated from popup to sidebar panel UI
- All operations now require user confirmation before execution
- Updated button styles for better visual hierarchy
- Improved error messaging and user feedback
- Enhanced modular architecture with Rule Inspector module
- Updated background.js to open sidebar on icon click

### Technical
- Created src/features/rules/inspector.js module
- Created src/sidepanel.html, src/sidepanel.js, src/sidepanel.css
- RuleInspector class with conflict detection algorithms
- API cost estimation function for all operations
- Modal system for confirmations
- Tab switching system
- Removed all emojis per coding standards

### UI/UX
- Modern gradient header with connection status
- Sticky group info banner
- Info icon tooltips showing API costs
- Confirmation modals with API cost breakdown
- Stats grid for rule metrics
- Rule cards with status badges and condition display

## [0.1.0] - 2024-11-14

### Added
- Export group members to CSV format with automatic download
- Export group members to JSON format with automatic download
- Optional status filtering for exports (export only ACTIVE, DEPROVISIONED, etc.)
- Smart Cleanup automation feature (removes DEPROVISIONED, SUSPENDED, and LOCKED_OUT users in one operation)
- Modular code architecture with core utilities
- API client module (OktaApiClient) for consistent API communication
- Pagination helper module for reusable pagination logic
- Session manager module for authentication token handling
- Export formatter module with CSV and JSON support
- Parser utilities for URL and data extraction
- New button styles (btn-success for export, btn-warning for smart cleanup)
- Downloads permission for file export functionality

### Changed
- Refactored codebase into modular structure
- Created separate directories: core/api, core/auth, core/utils, features/export
- Updated manifest.json to load modules in correct order
- Improved code organization for better maintainability
- Enhanced UI with new operation cards for export and smart cleanup

### Technical
- Export includes: Login, First Name, Last Name, Email, Status, Created Date, Last Login
- Automatic filename generation with timestamps (okta-group-NAME-TIMESTAMP.csv/json)
- CSV values properly escaped for commas, quotes, and newlines
- JSON output with pretty printing (2-space indentation)
- Smart Cleanup shows breakdown of users by status before removal
- All new features maintain same safety checks (group type validation, 403 handling, rate limiting)

## [0.0.1] - 2024-11-14

### Initial Release

First public release of Okta Unbound.

#### Features
- One-click removal of deprovisioned users from groups
- Custom status filtering with list/remove actions
- Support for all Okta user statuses (DEPROVISIONED, SUSPENDED, STAGED, PROVISIONED, ACTIVE, RECOVERY, LOCKED_OUT, PASSWORD_EXPIRED)
- Automatic pagination for large groups (handles 10,000+ members)
- Real-time progress tracking with progress bar
- Detailed operation logs with color-coded results (success/error/warning/info)
- Smart error handling and group type detection
- Session-based authentication (no API tokens required)
- Visual indicator when extension is active

#### Technical
- Chrome Extension Manifest V3
- Vanilla JavaScript (no build step)
- Works with okta.com, oktapreview.com, and okta-emea.com
- Extracts XSRF token from page for authenticated requests
- Rate limit protection (100ms delay between operations)
- Pagination delay protection (100ms between pages)
- Group type validation (warns for APP_GROUP and BUILT_IN groups)
- Stops on first 403 error to avoid log spam

#### Security
- Session-based authentication only
- No credentials stored
- Respects existing Okta permissions
- All operations use user's current session
