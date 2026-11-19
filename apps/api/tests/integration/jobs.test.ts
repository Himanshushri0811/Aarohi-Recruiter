import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Application } from 'express';
import { inProcess } from '../helpers/in-process.js';
import { generateAccessToken } from '../../src/modules/auth/auth.service.js';

interface MockJob {
  id: string;
  organizationId: string;
  title: string;
  department: string;
  location: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
  status: string;
  description: string;
  requirements: string | null;
  responsibilities: string | null;
  skills: string[];
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

let jobs: MockJob[] = [];
let orgs: any[] = [];
let memberships: any[] = [];

const mockPrisma = {
  job: {
    create: vi.fn(async ({ data }: { data: any }) => {
      const newJob: MockJob = {
        id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        organizationId: data.organizationId,
        title: data.title,
        department: data.department,
        location: data.location ?? 'Remote',
        employmentType: data.employmentType ?? 'FULL_TIME',
        experienceLevel: data.experienceLevel ?? 'MID',
        status: data.status ?? 'PUBLISHED',
        description: data.description,
        requirements: data.requirements ?? null,
        responsibilities: data.responsibilities ?? null,
        skills: data.skills ?? [],
        createdById: data.createdById ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      jobs.push(newJob);
      return newJob;
    }),
    findMany: vi.fn(async ({ where }: { where: any }) => {
      return jobs
        .filter((j) => {
          if (j.organizationId !== where.organizationId) return false;
          if (where.status && j.status !== where.status) return false;
          return true;
        })
        .map((j) => ({ ...j, _count: { applications: 0 } }));
    }),
    findFirst: vi.fn(async ({ where }: { where: any }) => {
      const j = jobs.find((item) => {
        if (where.id && item.id !== where.id) return false;
        if (where.organizationId && item.organizationId !== where.organizationId) return false;
        return true;
      });
      if (!j) return null;
      return { ...j, _count: { applications: 0 } };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const j = jobs.find((item) => item.id === where.id);
      if (!j) throw new Error('Job not found');
      Object.assign(j, data, { updatedAt: new Date() });
      return j;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      const idx = jobs.findIndex((item) => item.id === where.id);
      if (idx !== -1) jobs.splice(idx, 1);
      return {};
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
const testUserId = 'user-jobs-123';
const testOrgId = 'org-jobs-123';
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
  jobs = [];
  orgs = [{ id: testOrgId, name: 'Acme Corp', slug: 'acme-corp', status: 'ACTIVE' }];
  memberships = [{ userId: testUserId, organizationId: testOrgId, role: 'OWNER' }];
  vi.clearAllMocks();
});

describe('Jobs Module Integration Tests', () => {
  describe('GET /api/v1/organizations/:orgId/jobs', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/jobs`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects access if user is not a member of the organization with 403', async () => {
      const otherOrgToken = await generateAccessToken({
        sub: 'other-user',
        email: 'other@example.com',
      });
      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/jobs`, {
        headers: { authorization: `Bearer ${otherOrgToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('returns empty list when no jobs exist', async () => {
      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/jobs`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/v1/organizations/:orgId/jobs', () => {
    it('creates a new job with valid input', async () => {
      const res = await inProcess(app, 'POST', `/api/v1/organizations/${testOrgId}/jobs`, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          title: 'Senior Frontend Engineer',
          department: 'Engineering',
          description: 'Build world-class UI with React and TypeScript.',
          skills: ['React', 'TypeScript', 'Tailwind'],
        },
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Senior Frontend Engineer');
      expect(res.body.data.department).toBe('Engineering');
      expect(res.body.data.skills).toContain('React');
    });

    it('rejects invalid job input with 422', async () => {
      const res = await inProcess(app, 'POST', `/api/v1/organizations/${testOrgId}/jobs`, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          title: 'A', // too short
          department: '',
          description: 'Short', // too short
        },
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/organizations/:orgId/jobs/:jobId', () => {
    it('returns 404 for non-existent job', async () => {
      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/jobs/non-existent`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(404);
    });

    it('returns job details for existing job', async () => {
      const created = await mockPrisma.job.create({
        data: {
          organizationId: testOrgId,
          title: 'Backend Engineer',
          department: 'Engineering',
          description: 'Build high-performance microservices with Node.js and PostgreSQL.',
        },
      });

      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/jobs/${created.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(created.id);
      expect(res.body.data.title).toBe('Backend Engineer');
    });
  });

  describe('PUT /api/v1/organizations/:orgId/jobs/:jobId', () => {
    it('updates job details', async () => {
      const created = await mockPrisma.job.create({
        data: {
          organizationId: testOrgId,
          title: 'Staff Engineer',
          department: 'Engineering',
          description: 'Lead architecture and mentor senior engineering staff.',
        },
      });

      const res = await inProcess(app, 'PUT', `/api/v1/organizations/${testOrgId}/jobs/${created.id}`, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          title: 'Principal Engineer',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Principal Engineer');
    });
  });

  describe('PATCH /api/v1/organizations/:orgId/jobs/:jobId/status', () => {
    it('updates job status to ARCHIVED', async () => {
      const created = await mockPrisma.job.create({
        data: {
          organizationId: testOrgId,
          title: 'DevOps Engineer',
          department: 'Infrastructure',
          description: 'Manage cloud infrastructure with Kubernetes and Terraform.',
          status: 'PUBLISHED',
        },
      });

      const res = await inProcess(app, 'PATCH', `/api/v1/organizations/${testOrgId}/jobs/${created.id}/status`, {
        headers: { authorization: `Bearer ${token}` },
        body: { status: 'ARCHIVED' },
      });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ARCHIVED');
    });
  });
});
