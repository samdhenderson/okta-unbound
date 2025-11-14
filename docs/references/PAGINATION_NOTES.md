# Pagination Implementation Notes

## Overview

The extension properly handles Okta's cursor-based pagination to support groups of any size (beyond the 200 user API limit per request).

## Okta Pagination Behavior

### Link Headers

Okta returns pagination information via HTTP Link headers in the response:

```
Link: <https://your-domain.okta.com/api/v1/groups/{id}/users?limit=200>; rel="self"
Link: <https://your-domain.okta.com/api/v1/groups/{id}/users?after=00u1234567890&limit=200>; rel="next"
```

**Important**: Okta returns **multiple Link headers** (not a single comma-separated header). Modern browsers' Fetch API automatically combines these into a single header with comma separation.

### Cursor-Based Pagination

- The `after` parameter contains an opaque cursor pointing to the next page
- Cursors should NOT be constructed manually - always use the Link header URLs
- Pagination continues until no `rel="next"` link is present
- Maximum 200 users per page (Okta API limit)

## Implementation Details

### Getting All Members

The `getAllGroupMembers()` function:

1. Starts with `/api/v1/groups/{groupId}/users?limit=200`
2. Fetches the page
3. Parses the Link header to find `rel="next"`
4. Extracts the next page URL
5. Repeats until no next link exists
6. Returns all members across all pages

### Header Parsing

```javascript
// The browser combines multiple Link headers with commas
const links = linkHeader.split(',').map(link => link.trim());

for (const link of links) {
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
```

### Rate Limiting Protection

- 100ms delay between pagination requests
- 100ms delay between user removal operations
- Prevents hitting Okta's rate limits during bulk operations

## Performance

### Expected Timing

For a group with N members:

- **Pagination Time**: ~100ms per page (N/200 pages)
  - 200 users: 1 page = instant
  - 1000 users: 5 pages = ~500ms
  - 5000 users: 25 pages = ~2.5s

- **Removal Time**: ~100ms per user
  - 10 users: ~1 second
  - 50 users: ~5 seconds
  - 100 users: ~10 seconds

### Total Operation Time

For removing deprovisioned users:
```
Total Time = Pagination Time + (Number of Users to Remove × 100ms)
```

Example: Removing 20 deprovisioned users from a 1000-member group:
```
500ms (load all 1000) + (20 × 100ms) = 2.5 seconds total
```

## Progress Tracking

The extension provides real-time feedback:

```
Page 1: Loaded 200 members (Total: 200)
Page 2: Loaded 200 members (Total: 400)
Page 3: Loaded 200 members (Total: 600)
Page 4: Loaded 200 members (Total: 800)
Page 5: Loaded 150 members (Total: 950)
Pagination complete: 5 pages, 950 total members
```

## Testing

### Test Cases

1. **Small group** (< 200 users)
   - Should complete in single page
   - No pagination required

2. **Medium group** (200-1000 users)
   - Multiple pages required
   - Should see pagination progress

3. **Large group** (1000+ users)
   - Many pages required
   - Extended pagination time
   - Monitor for rate limiting

### Verification

To verify pagination is working:

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Filter for "users"
4. Run an operation on a 200+ member group
5. You should see multiple requests:
   - `/api/v1/groups/{id}/users?limit=200`
   - `/api/v1/groups/{id}/users?after=...&limit=200`
   - etc.

## Known Limitations

- Maximum 200 users per API request (Okta API limitation)
- Rate limits apply (extension includes delays to mitigate)
- Very large groups (5000+) may take several seconds to load
- Browser must remain open during operation

## Troubleshooting

### Pagination Not Working

If only 200 users are being processed:

1. Check browser console for errors
2. Verify Link headers are present in API response
3. Check if CORS is blocking headers
4. Ensure browser is not blocking the pagination requests

### Rate Limiting Errors

If seeing 429 errors:

1. Reduce batch size (already at minimum)
2. Increase delay between operations
3. Wait and retry later
4. Check your org's rate limits

## References

- [Okta API Pagination Documentation](https://developer.okta.com/docs/reference/core-okta-api/#pagination)
- [RFC 8288 - Web Linking](https://tools.ietf.org/html/rfc8288)
- [Fetch API Headers](https://developer.mozilla.org/en-US/docs/Web/API/Headers)
