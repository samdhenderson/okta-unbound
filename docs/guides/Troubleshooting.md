# Troubleshooting Guide

Solutions to common issues with Okta Unbound.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Extension Not Working](#extension-not-working)
- [API Request Failures](#api-request-failures)
- [Performance Issues](#performance-issues)
- [Operation Failures](#operation-failures)
- [Data & Caching Issues](#data--caching-issues)
- [Browser Console Errors](#browser-console-errors)

## Installation Issues

### Extension won't load in Chrome

**Symptoms:**
- Error when loading unpacked extension
- "Cannot load extension" message

**Solutions:**

1. **Check manifest.json exists**
   ```bash
   ls -la manifest.json
   ```

2. **Rebuild the extension**
   ```bash
   npm run build
   cd dist
   # Load the dist folder in Chrome
   ```

3. **Check Chrome version**
   - Requires Chrome 88 or higher
   - Update Chrome: Menu → Help → About Google Chrome

4. **Try incognito mode**
   - Go to `chrome://extensions/`
   - Toggle "Allow in incognito" for the extension
   - Test in an incognito window

### Build errors

**Symptoms:**
- `npm run build` fails
- TypeScript errors

**Solutions:**

1. **Clean install**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

2. **Check Node version**
   ```bash
   node --version  # Should be 18 or higher
   ```

3. **Update dependencies**
   ```bash
   npm update
   npm run build
   ```

## Extension Not Working

### Extension icon not visible

**Symptoms:**
- Can't find extension in toolbar
- Extension installed but not showing

**Solutions:**

1. **Pin the extension**
   - Click puzzle icon (🧩) in Chrome toolbar
   - Find "Okta Unbound"
   - Click pin icon

2. **Check if extension is enabled**
   - Go to `chrome://extensions/`
   - Verify toggle switch is ON for Okta Unbound

3. **Reload the extension**
   - Go to `chrome://extensions/`
   - Click refresh icon (🔄) on Okta Unbound card

### Sidebar doesn't open

**Symptoms:**
- Click extension icon, nothing happens
- Sidebar is blank

**Solutions:**

1. **Verify you're on an Okta page**
   - URL should contain: `okta.com`, `oktapreview.com`, or `okta-emea.com`
   - Extension only works on Okta domains

2. **Refresh the Okta page**
   - Press F5 or Ctrl/Cmd+R
   - Try opening extension again

3. **Check browser console for errors**
   - Press F12 to open DevTools
   - Look for errors in Console tab
   - Share errors when reporting issues

4. **Reload the extension**
   - Go to `chrome://extensions/`
   - Click refresh icon on Okta Unbound
   - Refresh Okta page

### Extension doesn't detect group

**Symptoms:**
- "No group detected" message
- Dashboard shows no data

**Solutions:**

1. **Verify URL format**
   - Should be: `https://your-domain.okta.com/admin/group/{groupId}`
   - Or: `https://your-domain.okta.com/groups/{groupId}`

2. **Refresh the page**
   - Reload the Okta page
   - Open extension again

3. **Try a different group**
   - Navigate to another group
   - See if that group is detected

4. **Check permissions**
   - Ensure you have access to view the group
   - Try with a group you know you can access

## API Request Failures

### "Permission Denied" errors

**Symptoms:**
- Operations fail with 403 errors
- "You don't have permission" messages

**Solutions:**

1. **Check your Okta role**
   - Ensure you have Group Administrator or Super Administrator role
   - Or appropriate delegated admin permissions

2. **Verify group type**
   - APP_GROUP: Cannot remove members (app-managed)
   - BUILT_IN: Cannot be modified (e.g., Everyone)
   - Try with a regular OKTA_GROUP

3. **Check session is valid**
   - Log out of Okta
   - Log back in
   - Try operation again

### "Session Expired" or 401 errors

**Symptoms:**
- Operations suddenly stop working
- Unauthorized errors

**Solutions:**

1. **Re-authenticate**
   - Log out of Okta
   - Clear cookies for Okta domain
   - Log back in
   - Try again

2. **Check MFA session**
   - Your MFA session may have expired
   - Re-authenticate with MFA

### Rate limiting (429 errors)

**Symptoms:**
- "Too many requests" errors
- Operations slow down or fail

**Solutions:**

1. **Wait and retry**
   - Wait 5-10 minutes
   - Try operation again

2. **Reduce operation scope**
   - Work on smaller groups
   - Process fewer groups in bulk operations

3. **Adjust rate limit settings** (Advanced)
   - Settings → API Rate Limiting
   - Increase delay between requests (e.g., 200ms instead of 100ms)

### CORS errors

**Symptoms:**
- "CORS policy" errors in console
- API requests blocked

**Solutions:**

1. **Refresh the page**
   - Usually resolves temporary CORS issues

2. **Check extension permissions**
   - Go to `chrome://extensions/`
   - Verify Okta domains are in host permissions

3. **Disable other extensions**
   - Some extensions interfere with CORS
   - Disable ad blockers and privacy extensions temporarily

## Performance Issues

### Extension is slow

**Symptoms:**
- Long load times
- Laggy UI
- Slow operations

**Solutions:**

1. **Clear cache**
   - Settings → Clear Cache
   - Reload extension

2. **Close unnecessary tabs**
   - Chrome extensions share resources
   - Close unused tabs

3. **Check group size**
   - Very large groups (5000+ members) naturally take longer
   - Consider breaking into smaller groups

4. **Update cache settings**
   - Settings → Cache Duration
   - Increase cache duration to reduce API calls

### Security scan takes forever

**Symptoms:**
- Security scan doesn't complete
- Progress bar stuck

**Solutions:**

1. **Cancel and retry**
   - Click "Cancel Operation"
   - Wait a few minutes
   - Try again

2. **Check group size**
   - Large groups (1000+ members) take 5-10 minutes
   - This is expected behavior

3. **Use cached results**
   - Security scan results are cached for 24 hours
   - Use cached results if recent

### Bulk operations timeout

**Symptoms:**
- Operations fail on large group sets
- Timeout errors

**Solutions:**

1. **Reduce batch size**
   - Process fewer groups at once (e.g., 25 instead of 50)

2. **Use collections**
   - Break large operations into multiple collections
   - Process each collection separately

## Operation Failures

### Remove users fails partway through

**Symptoms:**
- Operation stops midway
- Some users removed, others not

**Solutions:**

1. **Check audit log**
   - Audit tab shows what completed
   - Review errors for failed users

2. **Retry on remaining users**
   - Re-run the operation
   - Already-removed users will be skipped

3. **Check for permission changes**
   - Group ownership may have changed
   - Verify you still have permissions

### Smart Cleanup doesn't find users

**Symptoms:**
- "0 inactive users found" but you know there are some

**Solutions:**

1. **Clear cache**
   - Old member list may be cached
   - Settings → Clear Cache
   - Try again

2. **Verify user statuses**
   - Check users in Okta admin console
   - Confirm they have DEPROVISIONED, SUSPENDED, or LOCKED_OUT status

3. **Use Custom Filter**
   - Try filtering by specific status
   - This bypasses Smart Cleanup logic

### Export fails

**Symptoms:**
- Export button doesn't work
- No file downloads

**Solutions:**

1. **Check download permissions**
   - Browser may be blocking downloads
   - Check Chrome settings → Downloads
   - Allow downloads from Okta domain

2. **Check disk space**
   - Large exports require disk space
   - Ensure you have sufficient space

3. **Try smaller export**
   - Export with status filter
   - Export fewer groups

## Data & Caching Issues

### Stale data showing

**Symptoms:**
- Old member counts
- Outdated group info
- Removed users still appearing

**Solutions:**

1. **Manual refresh**
   - Click refresh icon (🔄) next to cached data

2. **Clear all cache**
   - Settings → Clear Cache
   - Reloads all data from Okta

3. **Wait for cache expiration**
   - Group list: 30 minutes
   - Member counts: 10 minutes
   - Rules: 5 minutes

### Collections not saving

**Symptoms:**
- Saved collections disappear
- Collections not loading

**Solutions:**

1. **Check storage permissions**
   - Go to `chrome://extensions/`
   - Verify storage permission is granted

2. **Clear and recreate**
   - Delete corrupted collection
   - Create new collection

3. **Check storage quota**
   - Chrome has storage limits
   - Clear old audit logs to free space

### Audit logs missing

**Symptoms:**
- Operations not logged
- Audit tab empty

**Solutions:**

1. **Check if logging is enabled**
   - Settings → Audit Logging
   - Verify it's enabled

2. **Check retention policy**
   - Old logs may have been auto-deleted
   - Settings → Retention Period

3. **Reset audit database** (Last resort)
   - Settings → Clear All Logs
   - Warning: This deletes all audit history

## Browser Console Errors

### How to access console

1. Open Chrome DevTools: Press F12 or Ctrl/Cmd+Shift+I
2. Click "Console" tab
3. Look for red error messages

### Common errors and solutions

#### "chrome.runtime.sendMessage: Could not establish connection"

**Cause:** Extension reloaded or crashed

**Solution:**
1. Reload extension in `chrome://extensions/`
2. Refresh Okta page

#### "Cannot read property 'id' of undefined"

**Cause:** Group not properly detected

**Solution:**
1. Ensure URL is valid group page
2. Refresh page
3. Try different group

#### "Failed to fetch"

**Cause:** Network error or CORS issue

**Solution:**
1. Check internet connection
2. Refresh page
3. Check for VPN/proxy issues

#### "Storage quota exceeded"

**Cause:** Too much cached data or audit logs

**Solution:**
1. Settings → Clear Cache
2. Settings → Clear All Logs (or reduce retention period)
3. Export audit logs before clearing

## Getting More Help

If you're still experiencing issues:

1. **Gather information**
   - Browser console errors (F12)
   - Steps to reproduce
   - Screenshots if helpful
   - Extension version (from `chrome://extensions/`)

2. **Search existing issues**
   - [GitHub Issues](https://github.com/samdhenderson/okta-unbound/issues)
   - Someone may have reported the same issue

3. **Report the bug**
   - [Open a new issue](https://github.com/samdhenderson/okta-unbound/issues/new?template=bug_report.md)
   - Include all gathered information
   - Be as specific as possible

4. **Check for updates**
   - Pull latest code: `git pull origin main`
   - Rebuild: `npm run build`
   - Reload extension

## Debug Mode

For advanced troubleshooting, enable debug mode:

1. Open extension DevTools:
   - Right-click extension icon
   - Select "Inspect popup"

2. In Console, enable verbose logging:
   ```javascript
   localStorage.setItem('debugMode', 'true')
   ```

3. Reload extension and reproduce issue

4. Copy console output for bug reports

5. Disable debug mode:
   ```javascript
   localStorage.removeItem('debugMode')
   ```

## Still Stuck?

- Review the [FAQ](../FAQ.md)
- Check the [full documentation](../Home.md)
- [Ask on GitHub Discussions](https://github.com/samdhenderson/okta-unbound/discussions)

[← Back to Home](../Home.md)
