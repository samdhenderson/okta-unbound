// Shared TypeScript types for the Okta Unbound extension

export interface OktaUser {
  id: string;
  status: UserStatus;
  profile: {
    login: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export type UserStatus =
  | 'ACTIVE'
  | 'DEPROVISIONED'
  | 'SUSPENDED'
  | 'STAGED'
  | 'PROVISIONED'
  | 'RECOVERY'
  | 'LOCKED_OUT'
  | 'PASSWORD_EXPIRED';

export interface OktaGroup {
  id: string;
  type: GroupType;
  profile: {
    name: string;
    description?: string;
  };
}

export type GroupType = 'OKTA_GROUP' | 'APP_GROUP' | 'BUILT_IN';

export interface OktaGroupRule {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  type: string;
  conditions?: any;
  actions?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
}

export interface GroupInfo {
  groupId: string;
  groupName: string;
}

export interface MessageRequest {
  action: 'getGroupInfo' | 'makeApiRequest' | 'exportGroupMembers' | 'fetchGroupRules';
  endpoint?: string;
  method?: string;
  body?: any;
  groupId?: string;
  groupName?: string;
  format?: 'csv' | 'json';
  statusFilter?: UserStatus | '';
}

export interface MessageResponse<T = any> extends ApiResponse<T> {
  count?: number;
  rules?: any[];
  stats?: RuleStats;
}

export interface RuleStats {
  total: number;
  active: number;
  inactive: number;
  conflicts: number;
}

export interface ProgressCallback {
  (current: number, total: number, message?: string): void;
}

export type ResultType = 'info' | 'success' | 'warning' | 'error';
