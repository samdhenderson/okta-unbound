import { http, HttpResponse } from 'msw';
import type { OktaUser, OktaGroup } from '../../shared/types';

// Mock data
export const mockUsers: OktaUser[] = Array.from({ length: 250 }, (_, i) => ({
  id: `user${i + 1}`,
  status: i < 5 ? 'DEPROVISIONED' : i < 10 ? 'SUSPENDED' : 'ACTIVE',
  profile: {
    login: `user${i + 1}@example.com`,
    email: `user${i + 1}@example.com`,
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
    department: 'Engineering',
    title: 'Developer',
  },
}));

export const mockGroup: OktaGroup = {
  id: 'group123',
  type: 'OKTA_GROUP',
  profile: {
    name: 'Test Group',
    description: 'A test group',
  },
};

export const handlers = [
  // Get group details
  http.get('https://example.okta.com/api/v1/groups/:groupId', () => {
    return HttpResponse.json(mockGroup);
  }),

  // Get group members with pagination
  http.get('https://example.okta.com/api/v1/groups/:groupId/users', ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '200');
    const after = url.searchParams.get('after');

    let startIndex = 0;
    if (after) {
      const afterIndex = parseInt(after);
      startIndex = afterIndex;
    }

    const endIndex = Math.min(startIndex + limit, mockUsers.length);
    const users = mockUsers.slice(startIndex, endIndex);

    // Generate Link header for pagination
    const headers: Record<string, string> = {};
    if (endIndex < mockUsers.length) {
      headers.link = `<https://example.okta.com/api/v1/groups/group123/users?limit=${limit}&after=${endIndex}>; rel="next"`;
    }

    return HttpResponse.json(users, { headers });
  }),

  // Remove user from group
  http.delete('https://example.okta.com/api/v1/groups/:groupId/users/:userId', () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
