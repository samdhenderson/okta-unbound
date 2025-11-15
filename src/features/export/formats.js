// Export formatters for different file formats
// Supports CSV and JSON exports with customizable fields

class ExportFormatter {
  // Default fields to include in export
  static defaultFields = [
    { key: 'login', label: 'Login' },
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'created', label: 'Created' },
    { key: 'lastLogin', label: 'Last Login' }
  ];

  // Extract data from user object based on field configuration
  static extractUserData(user, fields = this.defaultFields) {
    const data = {};

    fields.forEach(field => {
      switch (field.key) {
        case 'login':
          data[field.key] = user.profile?.login || '';
          break;
        case 'firstName':
          data[field.key] = user.profile?.firstName || '';
          break;
        case 'lastName':
          data[field.key] = user.profile?.lastName || '';
          break;
        case 'email':
          data[field.key] = user.profile?.email || '';
          break;
        case 'status':
          data[field.key] = user.status || '';
          break;
        case 'created':
          data[field.key] = user.created || '';
          break;
        case 'lastLogin':
          data[field.key] = user.lastLogin || '';
          break;
        case 'id':
          data[field.key] = user.id || '';
          break;
        default:
          // For custom fields, try to get from profile
          data[field.key] = user.profile?.[field.key] || '';
      }
    });

    return data;
  }

  // Convert users to CSV format
  static toCSV(users, fields = this.defaultFields) {
    if (!users || users.length === 0) {
      return '';
    }

    // Create header row
    const headers = fields.map(f => f.label).join(',');

    // Create data rows
    const rows = users.map(user => {
      const userData = this.extractUserData(user, fields);
      return fields.map(field => {
        const value = userData[field.key] || '';
        // Escape CSV values that contain commas, quotes, or newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    return [headers, ...rows].join('\n');
  }

  // Convert users to JSON format
  static toJSON(users, fields = this.defaultFields, pretty = true) {
    if (!users || users.length === 0) {
      return '[]';
    }

    const data = users.map(user => this.extractUserData(user, fields));
    return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  }

  // Trigger browser download of exported data
  static downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Export users as CSV and trigger download
  static exportAsCSV(users, groupName, fields = this.defaultFields) {
    const csv = this.toCSV(users, fields);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `okta-group-${groupName}-${timestamp}.csv`;
    this.downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  }

  // Export users as JSON and trigger download
  static exportAsJSON(users, groupName, fields = this.defaultFields) {
    const json = this.toJSON(users, fields);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `okta-group-${groupName}-${timestamp}.json`;
    this.downloadFile(json, filename, 'application/json;charset=utf-8;');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportFormatter;
}
