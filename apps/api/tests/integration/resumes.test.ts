import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Application } from 'express';
import { inProcess } from '../helpers/in-process.js';
import { generateAccessToken } from '../../src/modules/auth/auth.service.js';

interface MockResume {
  id: string;
  candidateId: string;
  organizationId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storageKey: string;
  extractedText: string | null;
  parsingStatus: string;
  parsedData: any;
  createdAt: Date;
  updatedAt: Date;
}

let resumes: MockResume[] = [];
let candidates: any[] = [];
let orgs: any[] = [];
let memberships: any[] = [];

const mockPrisma = {
  candidate: {
    findFirst: vi.fn(async ({ where }: { where: any }) => {
      return candidates.find((c) => c.id === where.id && c.organizationId === where.organizationId) || null;
    }),
  },
  resume: {
    create: vi.fn(async ({ data }: { data: any }) => {
      const newResume: MockResume = {
        id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        candidateId: data.candidateId,
        organizationId: data.organizationId,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileType: data.fileType,
        storageKey: data.storageKey,
        extractedText: data.extractedText ?? null,
        parsingStatus: data.parsingStatus ?? 'PENDING',
        parsedData: data.parsedData ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      resumes.push(newResume);
      return newResume;
    }),
    findMany: vi.fn(async ({ where }: { where: any }) => {
      return resumes.filter((r) => r.candidateId === where.candidateId && r.organizationId === where.organizationId);
    }),
    findFirst: vi.fn(async ({ where }: { where: any }) => {
      return resumes.find((r) => r.id === where.id && r.organizationId === where.organizationId) || null;
    }),
    findUnique: vi.fn(async ({ where }: { where: any }) => {
      return resumes.find((r) => r.id === where.id) || null;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const r = resumes.find((item) => item.id === where.id);
      if (!r) throw new Error('Resume not found');
      Object.assign(r, data, { updatedAt: new Date() });
      return r;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      const idx = resumes.findIndex((item) => item.id === where.id);
      if (idx !== -1) resumes.splice(idx, 1);
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

vi.mock('../../src/integrations/storage/storage.service.js', () => ({
  saveFile: vi.fn(async () => {}),
  deleteFile: vi.fn(async () => {}),
  buildStorageKey: vi.fn((orgId: string, folder: string, filename: string) => `${orgId}/${folder}/12345-${filename}`),
}));

vi.mock('../../src/integrations/resume-parser.js', () => ({
  extractText: vi.fn(async () => 'Skills: React, Node.js, TypeScript\nExperience: 5 years of experience'),
  parseResumeText: vi.fn((text: string) => ({
    name: 'Test Candidate',
    email: 'test@candidate.com',
    skills: ['React', 'Node.js', 'TypeScript'],
    experienceYears: 5,
    rawText: text,
  })),
}));

let app: Application;
const testUserId = 'user-resume-123';
const viewerUserId = 'viewer-resume-123';
const recruiterUserId = 'recruiter-resume-123';
const adminUserId = 'admin-resume-123';
const testOrgId = 'org-resume-123';
const testCandidateId = 'cand-resume-123';
let token: string;
let viewerToken: string;
let recruiterToken: string;
let adminToken: string;

beforeAll(async () => {
  const { createApp } = await import('../../src/app.js');
  app = createApp();
  token = await generateAccessToken({
    sub: testUserId,
    email: 'recruiter@example.com',
    organizationId: testOrgId,
  });
  viewerToken = await generateAccessToken({
    sub: viewerUserId,
    email: 'viewer@example.com',
    organizationId: testOrgId,
  });
  recruiterToken = await generateAccessToken({
    sub: recruiterUserId,
    email: 'recruiter-member@example.com',
    organizationId: testOrgId,
  });
  adminToken = await generateAccessToken({
    sub: adminUserId,
    email: 'admin@example.com',
    organizationId: testOrgId,
  });
});

beforeEach(() => {
  resumes = [];
  orgs = [{ id: testOrgId, name: 'Acme Corp', slug: 'acme-corp', status: 'ACTIVE' }];
  memberships = [
    { userId: testUserId, organizationId: testOrgId, role: 'OWNER' },
    { userId: viewerUserId, organizationId: testOrgId, role: 'VIEWER' },
    { userId: recruiterUserId, organizationId: testOrgId, role: 'RECRUITER' },
    { userId: adminUserId, organizationId: testOrgId, role: 'ADMIN' },
  ];
  candidates = [
    {
      id: testCandidateId,
      organizationId: testOrgId,
      firstName: 'Alice',
      lastName: 'Applicant',
      email: 'alice@applicant.com',
    },
  ];
  vi.clearAllMocks();
});

describe('Resumes Module Integration Tests', () => {
  describe('GET /api/v1/organizations/:orgId/candidates/:candidateId/resumes', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await inProcess(
        app,
        'GET',
        `/api/v1/organizations/${testOrgId}/candidates/${testCandidateId}/resumes`,
      );
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns empty list when candidate has no resumes', async () => {
      const res = await inProcess(
        app,
        'GET',
        `/api/v1/organizations/${testOrgId}/candidates/${testCandidateId}/resumes`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('DELETE /api/v1/organizations/:orgId/candidates/:candidateId/resumes/:resumeId', () => {
    it('deletes an existing resume', async () => {
      resumes.push({
        id: 'resume-to-delete',
        candidateId: testCandidateId,
        organizationId: testOrgId,
        fileName: 'resume.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        storageKey: `${testOrgId}/resumes/resume.pdf`,
        extractedText: 'some text',
        parsingStatus: 'PARSED',
        parsedData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await inProcess(
        app,
        'DELETE',
        `/api/v1/organizations/${testOrgId}/candidates/${testCandidateId}/resumes/resume-to-delete`,
        {
          headers: { authorization: `Bearer ${token}` },
        },
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(resumes).toHaveLength(0);
    });

    it('rejects a Viewer and preserves the resume', async () => {
      resumes.push({
        id: 'resume-viewer-delete',
        candidateId: testCandidateId,
        organizationId: testOrgId,
        fileName: 'resume.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        storageKey: `${testOrgId}/resumes/resume.pdf`,
        extractedText: 'some text',
        parsingStatus: 'PARSED',
        parsedData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await inProcess(
        app,
        'DELETE',
        `/api/v1/organizations/${testOrgId}/candidates/${testCandidateId}/resumes/resume-viewer-delete`,
        { headers: { authorization: `Bearer ${viewerToken}` } },
      );

      expect(res.status).toBe(403);
      expect(resumes).toHaveLength(1);
    });

    it.each([
      ['recruiter', () => recruiterToken],
      ['administrator', () => adminToken],
    ])('allows an authorized %s to delete a resume', async (_role, getToken) => {
      resumes.push({
        id: 'resume-authorized-delete',
        candidateId: testCandidateId,
        organizationId: testOrgId,
        fileName: 'resume.pdf',
        fileSize: 1024,
        fileType: 'application/pdf',
        storageKey: `${testOrgId}/resumes/resume.pdf`,
        extractedText: 'some text',
        parsingStatus: 'PARSED',
        parsedData: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await inProcess(
        app,
        'DELETE',
        `/api/v1/organizations/${testOrgId}/candidates/${testCandidateId}/resumes/resume-authorized-delete`,
        { headers: { authorization: `Bearer ${getToken()}` } },
      );

      expect(res.status).toBe(200);
      expect(resumes).toHaveLength(0);
    });
  });
});
