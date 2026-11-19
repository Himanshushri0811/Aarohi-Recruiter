import { describe, it, expect } from 'vitest';
import {
  Permission,
  ROLE_PERMISSIONS,
  hasPermission,
} from '../../src/modules/rbac/permissions.js';

describe('RBAC Permissions & Roles', () => {
  it('defines all required permissions', () => {
    expect(Permission.ORG_READ).toBe('org:read');
    expect(Permission.ORG_UPDATE).toBe('org:update');
    expect(Permission.ORG_DELETE).toBe('org:delete');
    expect(Permission.ORG_MANAGE_MEMBERS).toBe('org:manage_members');
    expect(Permission.USER_READ).toBe('user:read');
    expect(Permission.USER_INVITE).toBe('user:invite');
    expect(Permission.USER_REMOVE).toBe('user:remove');
    expect(Permission.INTERVIEW_CREATE).toBe('interview:create');
    expect(Permission.INTERVIEW_READ).toBe('interview:read');
    expect(Permission.INTERVIEW_CONDUCT).toBe('interview:conduct');
    expect(Permission.ADMIN_ALL).toBe('admin:all');
  });

  describe('OWNER / SUPER_ADMIN / ORGANIZATION_ADMIN', () => {
    it('SUPER_ADMIN has ADMIN_ALL and access to every permission', () => {
      expect(hasPermission('SUPER_ADMIN', Permission.ADMIN_ALL)).toBe(true);
      expect(hasPermission('SUPER_ADMIN', Permission.ORG_DELETE)).toBe(true);
      expect(hasPermission('SUPER_ADMIN', Permission.USER_REMOVE)).toBe(true);
      expect(hasPermission('SUPER_ADMIN', Permission.INTERVIEW_CREATE)).toBe(true);
    });

    it('OWNER has all management permissions', () => {
      expect(hasPermission('OWNER', Permission.ORG_DELETE)).toBe(true);
      expect(hasPermission('OWNER', Permission.ORG_UPDATE)).toBe(true);
      expect(hasPermission('OWNER', Permission.ORG_MANAGE_MEMBERS)).toBe(true);
      expect(hasPermission('OWNER', Permission.INTERVIEW_CREATE)).toBe(true);
      expect(hasPermission('OWNER', Permission.INTERVIEW_CONDUCT)).toBe(true);
    });

    it('ORGANIZATION_ADMIN has all organization administrative permissions', () => {
      expect(hasPermission('ORGANIZATION_ADMIN', Permission.ORG_UPDATE)).toBe(true);
      expect(hasPermission('ORGANIZATION_ADMIN', Permission.ORG_MANAGE_MEMBERS)).toBe(true);
      expect(hasPermission('ORGANIZATION_ADMIN', Permission.USER_INVITE)).toBe(true);
    });
  });

  describe('RECRUITER role', () => {
    it('can create and read interviews and users', () => {
      expect(hasPermission('RECRUITER', Permission.ORG_READ)).toBe(true);
      expect(hasPermission('RECRUITER', Permission.USER_READ)).toBe(true);
      expect(hasPermission('RECRUITER', Permission.INTERVIEW_CREATE)).toBe(true);
      expect(hasPermission('RECRUITER', Permission.INTERVIEW_READ)).toBe(true);
    });

    it('cannot update organization, delete organization or manage members', () => {
      expect(hasPermission('RECRUITER', Permission.ORG_UPDATE)).toBe(false);
      expect(hasPermission('RECRUITER', Permission.ORG_DELETE)).toBe(false);
      expect(hasPermission('RECRUITER', Permission.ORG_MANAGE_MEMBERS)).toBe(false);
      expect(hasPermission('RECRUITER', Permission.USER_REMOVE)).toBe(false);
    });
  });

  describe('VIEWER / INTERVIEWER role', () => {
    it('can read and conduct interviews, but cannot create interviews', () => {
      expect(hasPermission('VIEWER', Permission.ORG_READ)).toBe(true);
      expect(hasPermission('VIEWER', Permission.USER_READ)).toBe(true);
      expect(hasPermission('VIEWER', Permission.INTERVIEW_READ)).toBe(true);
      expect(hasPermission('VIEWER', Permission.INTERVIEW_CONDUCT)).toBe(true);
      expect(hasPermission('VIEWER', Permission.INTERVIEW_CREATE)).toBe(false);
      expect(hasPermission('VIEWER', Permission.ORG_UPDATE)).toBe(false);

      expect(hasPermission('INTERVIEWER', Permission.INTERVIEW_CONDUCT)).toBe(true);
      expect(hasPermission('INTERVIEWER', Permission.INTERVIEW_CREATE)).toBe(false);
    });
  });

  describe('Unknown or invalid roles', () => {
    it('returns false for unknown roles', () => {
      expect(hasPermission('GUEST', Permission.ORG_READ)).toBe(false);
      expect(hasPermission('', Permission.ORG_READ)).toBe(false);
      expect(hasPermission('UNKNOWN', Permission.ADMIN_ALL)).toBe(false);
    });
  });
});
