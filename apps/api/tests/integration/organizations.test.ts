import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Application } from 'express';
import { inProcess } from '../helpers/in-process.js';
import { generateAccessToken } from '../../src/modules/auth/auth.service.js';

interface MockOrg {
  id: string;
  name: string;
  slug: string;
  status: string;
  logoUrl?: string | null;
  settings?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface MockMembership {
  id: string;
  userId: string;
  organizationId: string;
  role: string;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization?: MockOrg;
}

let orgs: MockOrg[] = [];
let memberships: MockMembership[] = [];
let auditLogs: any[] = [];

const mockPrisma = {
  organization: {
    findUnique: vi.fn(async ({ where }: { where: { slug?: string; id?: string } }) => {
      const o = orgs.find((org) => (where.slug ? org.slug === where.slug : org.id === where.id));
      return o || null;
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const newOrg: MockOrg = {
        id: `org_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: data.name,
        slug: data.slug,
        status: data.status || 'ACTIVE',
        logoUrl: data.logoUrl || null,
        settings: data.settings || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      orgs.push(newOrg);
      return newOrg;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const o = orgs.find((org) => org.id === where.id);
      if (!o) throw new Error('Organization not found');
      Object.assign(o, data, { updatedAt: new Date() });
      return o;
    }),
  },
  membership: {
    findUnique: vi.fn(async ({ where }: { where: { userId_organizationId: { userId: string; organizationId: string } } }) => {
      const m = memberships.find(
        (mem) =>
          mem.userId === where.userId_organizationId.userId &&
          mem.organizationId === where.userId_organizationId.organizationId,
      );
      if (!m) return null;
      const org = orgs.find((o) => o.id === m.organizationId);
      return { ...m, organization: org };
    }),
    findMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
      const userMems = memberships.filter((mem) => mem.userId === where.userId);
      return userMems.map((m) => ({
        ...m,
        organization: orgs.find((o) => o.id === m.organizationId),
      }));
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const newMem: MockMembership = {
        id: `mem_${Date.now()}`,
        userId: data.userId,
        organizationId: data.organizationId,
        role: data.role || 'RECRUITER',
        acceptedAt: data.acceptedAt || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      memberships.push(newMem);
      return newMem;
    }),
  },
  auditLog: {
    create: vi.fn(async ({ data }: { data: any }) => {
      auditLogs.push(data);
      return { id: `al_${Date.now()}`, ...data, createdAt: new Date() };
    }),
  },
  $transaction: vi.fn(async (arg: any) => {
    if (typeof arg === 'function') {
      return arg(mockPrisma);
    }
    if (Array.isArray(arg)) {
      return Promise.all(arg);
    }
    return arg;
  }),
};

vi.mock('../../src/config/database.js', () => ({
  getPrismaClient: () => mockPrisma,
  disconnectPrisma: vi.fn(),
}));

let app: Application;

beforeAll(async () => {
  const { createApp } = await import('../../src/app.js');
  app = createApp();
});

beforeEach(() => {
  orgs = [];
  memberships = [];
  auditLogs = [];
  vi.clearAllMocks();
});

describe('Organization Onboarding & RBAC Integration Tests', () => {
  describe('POST /api/v1/organizations', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await inProcess(app, 'POST', '/api/v1/organizations', {
        body: { name: 'Acme Corp' },
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('creates organization and assigns creator as OWNER', async () => {
      const token = await generateAccessToken({
        sub: 'usr_founder_1',
        email: 'founder@acme.test',
      });

      const res = await inProcess(app, 'POST', '/api/v1/organizations', {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: {
          name: 'Acme Corporation',
          slug: 'acme-corp',
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Acme Corporation');
      expect(res.body.data.slug).toBe('acme-corp');
      expect(res.body.data.role).toBe('OWNER');

      // Verify DB state
      expect(orgs).toHaveLength(1);
      expect(memberships).toHaveLength(1);
      expect(memberships[0].userId).toBe('usr_founder_1');
      expect(memberships[0].role).toBe('OWNER');
    });

    it('auto-generates slug from name if slug is not provided', async () => {
      const token = await generateAccessToken({
        sub: 'usr_founder_2',
        email: 'founder2@acme.test',
      });

      const res = await inProcess(app, 'POST', '/api/v1/organizations', {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: { name: 'Alpha Beta Recruitment Ltd' },
      });

      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('alpha-beta-recruitment-ltd');
    });

    it('rejects duplicate slug with 409 Conflict', async () => {
      const token = await generateAccessToken({
        sub: 'usr_founder_3',
        email: 'founder3@acme.test',
      });

      // Seed existing org
      orgs.push({
        id: 'org_existing',
        name: 'Existing Company',
        slug: 'existing-co',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await inProcess(app, 'POST', '/api/v1/organizations', {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: {
          name: 'Existing Company',
          slug: 'existing-co',
        },
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });
  });

  describe('GET /api/v1/organizations', () => {
    it('returns all organizations the user belongs to', async () => {
      const userId = 'usr_multi_org';
      const token = await generateAccessToken({
        sub: userId,
        email: 'multi@example.com',
      });

      const org1: MockOrg = {
        id: 'org_1',
        name: 'Org One',
        slug: 'org-one',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const org2: MockOrg = {
        id: 'org_2',
        name: 'Org Two',
        slug: 'org-two',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      orgs.push(org1, org2);

      memberships.push(
        {
          id: 'm1',
          userId,
          organizationId: 'org_1',
          role: 'OWNER',
          acceptedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'm2',
          userId,
          organizationId: 'org_2',
          role: 'RECRUITER',
          acceptedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      );

      const res = await inProcess(app, 'GET', '/api/v1/organizations', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].role).toBe('OWNER');
      expect(res.body.data[1].role).toBe('RECRUITER');
    });
  });

  describe('GET /api/v1/organizations/:orgId — Strict Tenant Isolation', () => {
    it('allows access to single organization for verified member', async () => {
      const userId = 'usr_member';
      const token = await generateAccessToken({
        sub: userId,
        email: 'member@example.com',
      });

      const org: MockOrg = {
        id: 'org_tenant_1',
        name: 'Tenant One',
        slug: 'tenant-one',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      orgs.push(org);

      memberships.push({
        id: 'mem_t1',
        userId,
        organizationId: 'org_tenant_1',
        role: 'RECRUITER',
        acceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await inProcess(app, 'GET', '/api/v1/organizations/org_tenant_1', {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('org_tenant_1');
      expect(res.body.data.role).toBe('RECRUITER');
    });

    it('DENIES cross-tenant access when user is not a member (403 Forbidden)', async () => {
      const nonMemberToken = await generateAccessToken({
        sub: 'usr_external_attacker',
        email: 'attacker@other.com',
      });

      const victimOrg: MockOrg = {
        id: 'org_victim',
        name: 'Victim Corp',
        slug: 'victim-corp',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      orgs.push(victimOrg);

      // Attempting to access an organization the user does NOT belong to
      const res = await inProcess(app, 'GET', '/api/v1/organizations/org_victim', {
        headers: {
          authorization: `Bearer ${nonMemberToken}`,
        },
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/not a member/i);
    });
  });

  describe('PATCH /api/v1/organizations/:orgId — RBAC Permissions', () => {
    it('allows OWNER / ADMIN to update organization details', async () => {
      const ownerId = 'usr_owner';
      const token = await generateAccessToken({
        sub: ownerId,
        email: 'owner@org.test',
      });

      const org: MockOrg = {
        id: 'org_to_update',
        name: 'Initial Name',
        slug: 'initial-slug',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      orgs.push(org);

      memberships.push({
        id: 'mem_owner',
        userId: ownerId,
        organizationId: 'org_to_update',
        role: 'OWNER',
        acceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await inProcess(app, 'PATCH', '/api/v1/organizations/org_to_update', {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: { name: 'Updated Enterprise Name' },
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Enterprise Name');
    });

    it('DENIES RECRUITER from updating organization details (403 Forbidden)', async () => {
      const recruiterId = 'usr_recruiter';
      const token = await generateAccessToken({
        sub: recruiterId,
        email: 'recruiter@org.test',
      });

      const org: MockOrg = {
        id: 'org_locked',
        name: 'Locked Org',
        slug: 'locked-org',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      orgs.push(org);

      memberships.push({
        id: 'mem_recruiter',
        userId: recruiterId,
        organizationId: 'org_locked',
        role: 'RECRUITER',
        acceptedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await inProcess(app, 'PATCH', '/api/v1/organizations/org_locked', {
        headers: {
          authorization: `Bearer ${token}`,
        },
        body: { name: 'Hacked Org Name' },
      });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toMatch(/lacks required permission/i);
    });
  });
});
