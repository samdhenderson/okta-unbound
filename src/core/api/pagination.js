// Pagination utilities for handling large Okta result sets
// Okta uses Link headers with rel="next" for cursor-based pagination

class PaginationHelper {
  // Parse Link header to extract next page URL
  static parseNextLink(linkHeader) {
    if (!linkHeader) return null;

    const links = linkHeader.split(',').map(link => link.trim());

    for (const link of links) {
      if (link.includes('rel="next"')) {
        const match = link.match(/<([^>]+)>/);
        if (match) {
          const fullUrl = match[1];
          const url = new URL(fullUrl);
          return url.pathname + url.search;
        }
      }
    }

    return null;
  }

  // Fetch all pages from a paginated endpoint
  static async fetchAllPages(apiClient, initialEndpoint, onProgress = null) {
    let allItems = [];
    let nextUrl = initialEndpoint;
    let pageCount = 0;

    while (nextUrl) {
      pageCount++;
      const response = await apiClient.makeRequest(nextUrl);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch data');
      }

      const pageSize = response.data.length;
      allItems = allItems.concat(response.data);

      if (onProgress) {
        onProgress({
          pageCount,
          pageSize,
          totalItems: allItems.length,
          message: `Page ${pageCount}: Loaded ${pageSize} items (Total: ${allItems.length})`
        });
      }

      nextUrl = this.parseNextLink(response.headers?.link);

      // Delay between pages to avoid rate limiting
      if (nextUrl) {
        await this._sleep(100);
      }
    }

    return {
      items: allItems,
      pageCount,
      totalCount: allItems.length
    };
  }

  // Sleep helper for rate limiting
  static _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaginationHelper;
}
