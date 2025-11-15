// Export feature core logic
// Handles fetching group members and coordinating export operations

class GroupExporter {
  constructor(apiClient, paginationHelper, formatter) {
    this.apiClient = apiClient;
    this.paginationHelper = paginationHelper;
    this.formatter = formatter;
  }

  // Export group members with progress tracking
  async exportGroupMembers(groupId, groupName, format = 'csv', options = {}) {
    const {
      fields = this.formatter.defaultFields,
      statusFilter = null,
      onProgress = null
    } = options;

    try {
      // Notify start
      if (onProgress) {
        onProgress({ stage: 'start', message: `Starting export of group: ${groupName}` });
      }

      // Fetch all group members with pagination
      const endpoint = `/api/v1/groups/${groupId}/users?limit=200`;
      const result = await this.paginationHelper.fetchAllPages(
        this.apiClient,
        endpoint,
        (progressInfo) => {
          if (onProgress) {
            onProgress({
              stage: 'fetching',
              ...progressInfo
            });
          }
        }
      );

      let members = result.items;

      // Apply status filter if specified
      if (statusFilter) {
        const originalCount = members.length;
        members = members.filter(user => user.status === statusFilter);
        if (onProgress) {
          onProgress({
            stage: 'filtering',
            message: `Filtered to ${members.length} users with status ${statusFilter} (from ${originalCount} total)`
          });
        }
      }

      if (members.length === 0) {
        if (onProgress) {
          onProgress({
            stage: 'complete',
            message: 'No members to export',
            success: false
          });
        }
        return { success: false, message: 'No members to export' };
      }

      // Export based on format
      if (onProgress) {
        onProgress({
          stage: 'exporting',
          message: `Generating ${format.toUpperCase()} file for ${members.length} members...`
        });
      }

      if (format === 'csv') {
        this.formatter.exportAsCSV(members, groupName, fields);
      } else if (format === 'json') {
        this.formatter.exportAsJSON(members, groupName, fields);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      if (onProgress) {
        onProgress({
          stage: 'complete',
          message: `Successfully exported ${members.length} members to ${format.toUpperCase()}`,
          success: true,
          count: members.length
        });
      }

      return {
        success: true,
        count: members.length,
        format: format
      };

    } catch (error) {
      if (onProgress) {
        onProgress({
          stage: 'error',
          message: `Export failed: ${error.message}`,
          success: false
        });
      }
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GroupExporter;
}
