# Changelog

All notable changes to Okta Unbound will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
