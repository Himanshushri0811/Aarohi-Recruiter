import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Application } from 'express';
import { inProcess } from '../helpers/in-process.js';
import { generateAccessToken } from '../../src/modules/auth/auth.service.js';

interface MockCandidate {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  location: string | null;
  headline: string | null;
  summary: string | null;
  skills: string[];
  experienceYears: number | null;
  status: string;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

let candidates: MockCandidate[] = [];
let orgs: any[] = [];
let memberships: any[] = [];

const mockPrisma = {
  candidate: {
    findUnique: vi.fn(async ({ where }: { where: any }) => {
      if (where.organizationId_email) {
        return (
          candidates.find(
            (c) =>
              c.organizationId === where.organizationId_email.organizationId &&
              c.email === where.organizationId_email.email,
          ) || null
        );
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where }: { where: any }) => {
      const c = candidates.find((item) => {
        if (where.id && item.id !== where.id) return false;
        if (where.organizationId && item.organizationId !== where.organizationId) return false;
        return true;
      });
      if (!c) return null;
      return { ...c, resumes: [], _count: { applications: 0 } };
    }),
    findMany: vi.fn(async ({ where }: { where: any }) => {
      return candidates
        .filter((c) => {
          if (c.organizationId !== where.organizationId) return false;
          if (where.status && c.status !== where.status) return false;
          return true;
        })
        .map((c) => ({ ...c, _count: { resumes: 0, applications: 0 } }));
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const newCand: MockCandidate = {
        id: `cand_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        organizationId: data.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone ?? null,
        location: data.location ?? null,
        headline: data.headline ?? null,
        summary: data.summary ?? null,
        skills: data.skills ?? [],
        experienceYears: data.experienceYears ?? null,
        status: data.status ?? 'NEW',
        metadata: data.metadata ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      candidates.push(newCand);
      return newCand;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const c = candidates.find((item) => item.id === where.id);
      if (!c) throw new Error('Candidate not found');
      Object.assign(c, data, { updatedAt: new Date() });
      return c;
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
  },
};

vi.mock('../../src/config/database.js', () => ({
  getPrismaClient: () => mockPrisma,
  disconnectPrisma: vi.fn(),
}));

let app: Application;
const testUserId = 'user-candidates-123';
const testOrgId = 'org-candidates-123';
let token: string;

beforeAll(async () => {
  const { createApp } = await import('../../src/app.js');
  app = createApp();
  token = await generateAccessToken({
    sub: testUserId,
    email: 'recruiter@example.com',
    organizationId: testOrgId,
  });
});

beforeEach(() => {
  candidates = [];
  orgs = [{ id: testOrgId, name: 'Acme Corp', slug: 'acme-corp', status: 'ACTIVE' }];
  memberships = [{ userId: testUserId, organizationId: testOrgId, role: 'OWNER' }];
  vi.clearAllMocks();
});

describe('Candidates Module Integration Tests', () => {
  describe('GET /api/v1/organizations/:orgId/candidates', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/candidates`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects access from non-member with 403', async () => {
      const otherToken = await generateAccessToken({
        sub: 'other-user',
        email: 'other@example.com',
      });
      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/candidates`, {
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('returns empty array when no candidates exist', async () => {
      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/candidates`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/v1/organizations/:orgId/candidates', () => {
    it('creates a candidate profile', async () => {
      const res = await inProcess(app, 'POST', `/api/v1/organizations/${testOrgId}/candidates`, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          headline: 'Full Stack Engineer',
          skills: ['Node.js', 'React', 'PostgreSQL'],
          experienceYears: 5,
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('John');
      expect(res.body.data.email).toBe('john.doe@example.com');
      expect(res.body.data.skills).toContain('Node.js');
    });

    it('rejects duplicate email within the same organization with 409', async () => {
      await mockPrisma.candidate.create({
        data: {
          organizationId: testOrgId,
          firstName: 'Existing',
          lastName: 'User',
          email: 'existing@example.com',
        },
      });

      const res = await inProcess(app, 'POST', `/api/v1/organizations/${testOrgId}/candidates`, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          firstName: 'Another',
          lastName: 'User',
          email: 'existing@example.com',
        },
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/organizations/:orgId/candidates/:candidateId', () => {
    it('returns candidate profile', async () => {
      const created = await mockPrisma.candidate.create({
        data: {
          organizationId: testOrgId,
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
        },
      });

      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/candidates/${created.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(created.id);
      expect(res.body.data.email).toBe('alice@example.com');
    });
  });

  describe('PUT /api/v1/organizations/:orgId/candidates/:candidateId', () => {
    it('updates candidate details', async () => {
      const created = await mockPrisma.candidate.create({
        data: {
          organizationId: testOrgId,
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@example.com',
        },
      });

      const res = await inProcess(app, 'PUT', `/api/v1/organizations/${testOrgId}/candidates/${created.id}`, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          headline: 'Lead Architect',
          experienceYears: 10,
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.headline).toBe('Lead Architect');
      expect(res.body.data.experienceYears).toBe(10);
    });
  });

  describe('PATCH /api/v1/organizations/:orgId/candidates/:candidateId/archive', () => {
    it('archives candidate', async () => {
      const created = await mockPrisma.candidate.create({
        data: {
          organizationId: testOrgId,
          firstName: 'Charlie',
          lastName: 'Brown',
          email: 'charlie@example.com',
          status: 'NEW',
        },
      });

      const res = await inProcess(app, 'PATCH', `/api/v1/organizations/${testOrgId}/candidates/${created.id}/archive`, {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ARCHIVED');
    });
  });
});
