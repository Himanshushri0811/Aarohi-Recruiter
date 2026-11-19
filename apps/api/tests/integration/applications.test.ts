import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Application } from 'express';
import { Prisma } from '@prisma/client';
import { inProcess } from '../helpers/in-process.js';
import { generateAccessToken } from '../../src/modules/auth/auth.service.js';

interface MockApp {
  id: string;
  organizationId: string;
  jobId: string;
  candidateId: string;
  resumeId: string | null;
  status: string;
  stage: string;
  matchScore: number | null;
  analysis: any;
  createdAt: Date;
  updatedAt: Date;
}

let apps: MockApp[] = [];
let jobs: any[] = [];
let candidates: any[] = [];
let resumes: any[] = [];
let analysisRecords: any[] = [];
let orgs: any[] = [];
let memberships: any[] = [];

const mockPrisma = {
  job: {
    findFirst: vi.fn(async ({ where }: { where: any }) => {
      return jobs.find((j) => j.id === where.id && j.organizationId === where.organizationId) || null;
    }),
  },
  candidate: {
    findFirst: vi.fn(async ({ where }: { where: any }) => {
      return candidates.find((c) => c.id === where.id && c.organizationId === where.organizationId) || null;
    }),
  },
  resume: {
    findFirst: vi.fn(async ({ where }: { where: any }) => {
      return resumes
        .filter((resume) =>
          Object.entries(where)
            .filter(([key]) => key !== 'orderBy')
            .every(([key, value]) => resume[key] === value),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;
    }),
  },
  application: {
    findUnique: vi.fn(async ({ where }: { where: any }) => {
      if (where.jobId_candidateId) {
        return (
          apps.find(
            (a) =>
              a.jobId === where.jobId_candidateId.jobId &&
              a.candidateId === where.jobId_candidateId.candidateId,
          ) || null
        );
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where }: { where: any }) => {
      const a = apps.find((item) => item.id === where.id && item.organizationId === where.organizationId);
      if (!a) return null;
      return {
        ...a,
        job: jobs.find((j) => j.id === a.jobId),
        candidate: candidates.find((c) => c.id === a.candidateId),
        resume: resumes.find((resume) => resume.id === a.resumeId) || null,
      };
    }),
    findMany: vi.fn(async ({ where }: { where: any }) => {
      return apps
        .filter((a) => {
          if (a.organizationId !== where.organizationId) return false;
          if (where.jobId && a.jobId !== where.jobId) return false;
          if (where.candidateId && a.candidateId !== where.candidateId) return false;
          return true;
        })
        .map((a) => ({
          ...a,
          job: jobs.find((j) => j.id === a.jobId),
          candidate: candidates.find((c) => c.id === a.candidateId),
          resume: null,
        }));
    }),
    create: vi.fn(async ({ data }: { data: any }) => {
      const newApp: MockApp = {
        id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        organizationId: data.organizationId,
        jobId: data.jobId,
        candidateId: data.candidateId,
        resumeId: data.resumeId ?? null,
        status: 'APPLIED',
        stage: data.stage ?? 'Resume Screening',
        matchScore: data.matchScore ?? null,
        analysis: data.analysis ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      apps.push(newApp);
      return {
        ...newApp,
        job: jobs.find((j) => j.id === data.jobId),
        candidate: candidates.find((c) => c.id === data.candidateId),
        resume: null,
      };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
      const a = apps.find((item) => item.id === where.id);
      if (!a) throw new Error('Application not found');
      Object.assign(a, data, { updatedAt: new Date() });
      return {
        ...a,
        job: jobs.find((j) => j.id === a.jobId),
        candidate: candidates.find((c) => c.id === a.candidateId),
        resume: null,
      };
    }),
    updateMany: vi.fn(async ({ where, data }: { where: any; data: any }) => {
      const a = apps.find((item) => item.id === where.id && item.organizationId === where.organizationId);
      if (!a || (where.status && a.status !== where.status)) return { count: 0 };
      if (where.analysis?.equals === Prisma.DbNull) {
        if (a.analysis !== null) return { count: 0 };
      } else if (
        where.analysis?.equals &&
        JSON.stringify(a.analysis) !== JSON.stringify(where.analysis.equals)
      ) {
        return { count: 0 };
      }
      if (where.analysis === null && a.analysis !== null) return { count: 0 };
      Object.assign(a, data, { updatedAt: new Date() });
      return { count: 1 };
    }),
  },
  resumeAnalysis: {
    create: vi.fn(async ({ data }: { data: any }) => {
      const analysis = {
        id: `analysis-${Date.now()}`,
        createdAt: new Date(),
        ...data,
      };
      analysisRecords.push(analysis);
      return analysis;
    }),
    findFirst: vi.fn(async ({ where }: { where: any }) =>
      analysisRecords.find((analysis) =>
        Object.entries(where).every(([key, value]) => analysis[key] === value),
      ) || null,
    ),
  },
  $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(mockPrisma)),
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
const testUserId = 'user-app-123';
const testOrgId = 'org-app-123';
const testJobId = 'job-app-123';
const testCandidateId = 'cand-app-123';
const testApplicationId = 'app-screening-123';
let token: string;

const validReport = {
  matchScore: 78,
  analysisConfidence: 'medium',
  insufficientInformation: false,
  fitSummary: 'The resume provides relevant TypeScript and API experience.',
  requiredSkills: [
    {
      skill: 'TypeScript',
      title: 'TypeScript',
      status: 'demonstrated',
      summary: 'Used in relevant application work.',
      resumeEvidence: ['Built TypeScript services for customer applications.'],
      jobEvidence: ['Required: TypeScript and API design.'],
      confidence: 'high',
    },
    {
      skill: 'API design',
      title: 'API design',
      status: 'not_evidenced',
      summary: 'The resume does not provide direct evidence for this requirement.',
      resumeEvidence: [],
      jobEvidence: ['Required: TypeScript and API design.'],
      confidence: 'medium',
    },
  ],
  preferredSkills: [],
  experienceAssessment: {
    title: 'Relevant experience',
    status: 'partial',
    summary: 'Some directly relevant implementation work is described.',
    resumeEvidence: ['Built TypeScript services for customer applications.'],
    jobEvidence: ['Build reliable web services and user interfaces.'],
    confidence: 'medium',
  },
  projectAssessments: [],
  educationAssessment: {
    title: 'Education',
    status: 'not_applicable',
    summary: 'No specific education requirement was supplied.',
    resumeEvidence: [],
    jobEvidence: ['Description:\nBuild reliable web services and user interfaces.'],
    confidence: 'medium',
  },
  missingQualifications: [],
  strengths: [],
  gaps: [],
  suggestedInterviewTopics: ['Ask for an example of API design work.'],
};

function seedScreeningApplication(resumeOverrides: Record<string, unknown> = {}) {
  apps.push({
    id: testApplicationId,
    organizationId: testOrgId,
    jobId: testJobId,
    candidateId: testCandidateId,
    resumeId: 'resume-screening-123',
    status: 'APPLIED',
    stage: 'Resume Screening',
    matchScore: null,
    analysis: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  resumes.push({
    id: 'resume-screening-123',
    organizationId: testOrgId,
    candidateId: testCandidateId,
    fileName: 'resume.pdf',
    parsingStatus: 'PARSED',
    extractedText: 'Built TypeScript services for customer applications.',
    parsedData: { skills: ['TypeScript'], rawText: 'resume content' },
    createdAt: new Date(),
    ...resumeOverrides,
  });
}

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
  vi.unstubAllGlobals();
  apps = [];
  resumes = [];
  analysisRecords = [];
  orgs = [{ id: testOrgId, name: 'Acme Corp', slug: 'acme-corp', status: 'ACTIVE' }];
  memberships = [{ userId: testUserId, organizationId: testOrgId, role: 'OWNER' }];
  jobs = [
    {
      id: testJobId,
      organizationId: testOrgId,
      title: 'Full Stack Engineer',
      department: 'Engineering',
      description: 'Build reliable web services and user interfaces.',
      requirements: 'Required: TypeScript and API design.',
      responsibilities: 'Design and maintain application services.',
      skills: ['TypeScript', 'API design'],
      location: 'Remote',
      employmentType: 'FULL_TIME',
      experienceLevel: 'MID',
      status: 'PUBLISHED',
    },
  ];
  candidates = [
    {
      id: testCandidateId,
      organizationId: testOrgId,
      firstName: 'Jane',
      lastName: 'Developer',
      email: 'jane@example.com',
    },
  ];
  vi.clearAllMocks();
});

describe('Applications Module Integration Tests', () => {
  describe('GET /api/v1/organizations/:orgId/applications', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/applications`);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns applications list', async () => {
      const res = await inProcess(app, 'GET', `/api/v1/organizations/${testOrgId}/applications`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/v1/organizations/:orgId/applications', () => {
    it('creates an application linking candidate and job', async () => {
      const res = await inProcess(app, 'POST', `/api/v1/organizations/${testOrgId}/applications`, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          jobId: '11111111-1111-4111-8111-111111111111',
          candidateId: '22222222-2222-4222-8222-222222222222',
        },
      });

      // Update mock jobs and candidates to match these UUIDs
      jobs.push({
        id: '11111111-1111-4111-8111-111111111111',
        organizationId: testOrgId,
        title: 'Backend Lead',
      });
      candidates.push({
        id: '22222222-2222-4222-8222-222222222222',
        organizationId: testOrgId,
        firstName: 'Sam',
        lastName: 'Coder',
        email: 'sam@coder.com',
      });

      const res2 = await inProcess(app, 'POST', `/api/v1/organizations/${testOrgId}/applications`, {
        headers: { authorization: `Bearer ${token}` },
        body: {
          jobId: '11111111-1111-4111-8111-111111111111',
          candidateId: '22222222-2222-4222-8222-222222222222',
        },
      });

      expect(res2.status).toBe(201);
      expect(res2.body.success).toBe(true);
      expect(res2.body.data.stage).toBe('Resume Screening');
    });

    it('rejects duplicate application with 409', async () => {
      const jobId = '33333333-3333-4333-8333-333333333333';
      const candId = '44444444-4444-4444-8444-444444444444';

      jobs.push({ id: jobId, organizationId: testOrgId, title: 'AI Engineer' });
      candidates.push({ id: candId, organizationId: testOrgId, firstName: 'A', lastName: 'B', email: 'ab@test.com' });
      apps.push({
        id: 'app-existing',
        organizationId: testOrgId,
        jobId,
        candidateId: candId,
        resumeId: null,
        status: 'APPLIED',
        stage: 'Resume Screening',
        matchScore: null,
        analysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await inProcess(app, 'POST', `/api/v1/organizations/${testOrgId}/applications`, {
        headers: { authorization: `Bearer ${token}` },
        body: { jobId, candidateId: candId },
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /api/v1/organizations/:orgId/applications/:applicationId/status', () => {
    it('updates application status and stage', async () => {
      const createdApp: MockApp = {
        id: 'app-test-status',
        organizationId: testOrgId,
        jobId: testJobId,
        candidateId: testCandidateId,
        resumeId: null,
        status: 'APPLIED',
        stage: 'Resume Screening',
        matchScore: null,
        analysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      apps.push(createdApp);

      const res = await inProcess(
        app,
        'PATCH',
        `/api/v1/organizations/${testOrgId}/applications/${createdApp.id}/status`,
        {
          headers: { authorization: `Bearer ${token}` },
          body: {
            status: 'INTERVIEW_SCHEDULED',
            stage: 'AI Technical Interview',
          },
        },
      );

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('INTERVIEW_SCHEDULED');
      expect(res.body.data.stage).toBe('AI Technical Interview');
    });

    it('does not accept client-supplied AI scores or reports', async () => {
      const createdApp: MockApp = {
        id: 'app-test-untrusted-report',
        organizationId: testOrgId,
        jobId: testJobId,
        candidateId: testCandidateId,
        resumeId: null,
        status: 'APPLIED',
        stage: 'Resume Screening',
        matchScore: null,
        analysis: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      apps.push(createdApp);

      const response = await inProcess(
        app,
        'PATCH',
        `/api/v1/organizations/${testOrgId}/applications/${createdApp.id}/status`,
        {
          headers: { authorization: `Bearer ${token}` },
          body: {
            status: 'APPLIED',
            matchScore: 100,
            analysis: { status: 'COMPLETED', report: validReport },
          },
        },
      );

      expect(response.status).toBe(200);
      expect(createdApp.matchScore).toBeNull();
      expect(createdApp.analysis).toBeNull();
    });
  });

  describe('POST /api/v1/organizations/:orgId/applications/:applicationId/screen', () => {
    const endpoint = () =>
      `/api/v1/organizations/${testOrgId}/applications/${testApplicationId}/screen`;

    it('sends parsed resume and complete job details to AI and persists an explainable report', async () => {
      seedScreeningApplication();
      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
        const requestBody = JSON.parse(String(init?.body));
        expect(requestBody.resumeText).toContain('Built TypeScript services');
        expect(requestBody.parsedResume.skills).toContain('TypeScript');
        expect(requestBody.jobDescription).toContain('Responsibilities:');
        expect(requestBody.jobDescription).toContain('Required: TypeScript and API design.');
        expect(requestBody.jobSkills).toEqual(['TypeScript', 'API design']);
        expect(requestBody.applicationId).toBe(testApplicationId);
        return new Response(JSON.stringify(validReport), { status: 200 });
      });
      vi.stubGlobal('fetch', fetchMock);

      const response = await inProcess(app, 'POST', endpoint(), {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expect(response.body.data.report.matchScore).toBe(78);
      expect(response.body.data.report.requiredSkills[1].status).toBe('not_evidenced');
      expect(apps[0].status).toBe('SCREENING');
      expect(apps[0].matchScore).toBe(78);
      expect((apps[0].analysis as any).status).toBe('COMPLETED');
      expect(mockPrisma.resumeAnalysis.create).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns the saved report on repeat requests without creating a duplicate analysis', async () => {
      seedScreeningApplication();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(validReport), { status: 200 })),
      );
      const first = await inProcess(app, 'POST', endpoint(), {
        headers: { authorization: `Bearer ${token}` },
      });
      const second = await inProcess(app, 'POST', endpoint(), {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.data.analysisId).toBe(first.body.data.analysisId);
      expect(mockPrisma.resumeAnalysis.create).toHaveBeenCalledTimes(1);
    });

    it('serves the completed report through the organization-scoped application detail API', async () => {
      seedScreeningApplication();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(validReport), { status: 200 })),
      );
      await inProcess(app, 'POST', endpoint(), {
        headers: { authorization: `Bearer ${token}` },
      });

      const response = await inProcess(
        app,
        'GET',
        `/api/v1/organizations/${testOrgId}/applications/${testApplicationId}`,
        { headers: { authorization: `Bearer ${token}` } },
      );

      expect(response.status).toBe(200);
      expect(response.body.data.analysis.status).toBe('COMPLETED');
      expect(response.body.data.analysis.report.matchScore).toBe(78);
      expect(response.body.data.matchScore).toBe(78);
    });

    it('rejects concurrent duplicate screening requests', async () => {
      seedScreeningApplication();
      let releaseResponse: ((response: Response) => void) | undefined;
      const fetchMock = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            releaseResponse = resolve;
          }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const firstRequest = inProcess(app, 'POST', endpoint(), {
        headers: { authorization: `Bearer ${token}` },
      });
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      const statusChange = await inProcess(
        app,
        'PATCH',
        `/api/v1/organizations/${testOrgId}/applications/${testApplicationId}/status`,
        {
          headers: { authorization: `Bearer ${token}` },
          body: { status: 'INTERVIEW_SCHEDULED' },
        },
      );
      expect(statusChange.status).toBe(409);
      const secondResponse = await inProcess(app, 'POST', endpoint(), {
        headers: { authorization: `Bearer ${token}` },
      });
      releaseResponse?.(new Response(JSON.stringify(validReport), { status: 200 }));
      const firstResponse = await firstRequest;

      expect(firstResponse.status).toBe(200);
      expect(secondResponse.status).toBe(409);
      expect(mockPrisma.resumeAnalysis.create).toHaveBeenCalledTimes(1);
    });

    it('rejects invalid or insufficiently parsed resume documents', async () => {
      seedScreeningApplication({ parsingStatus: 'FAILED', extractedText: null });
      const failedResume = await inProcess(app, 'POST', endpoint(), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(failedResume.status).toBe(422);

      apps = [];
      resumes = [];
      seedScreeningApplication({ extractedText: 'Too short.' });
      const shortResume = await inProcess(app, 'POST', endpoint(), {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(shortResume.status).toBe(422);
    });

    it('marks provider failures retryable without changing the application decision', async () => {
      seedScreeningApplication();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ detail: 'unavailable' }), { status: 503 })),
      );

      const response = await inProcess(app, 'POST', endpoint(), {
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(503);
      expect(apps[0].status).toBe('APPLIED');
      expect((apps[0].analysis as any).status).toBe('FAILED');
    });

    it('enforces recruiter permission and organization membership', async () => {
      seedScreeningApplication();
      const viewerId = 'user-app-viewer';
      memberships.push({ userId: viewerId, organizationId: testOrgId, role: 'VIEWER' });
      const viewerToken = await generateAccessToken({
        sub: viewerId,
        email: 'viewer@example.com',
        organizationId: testOrgId,
      });
      const forbidden = await inProcess(app, 'POST', endpoint(), {
        headers: { authorization: `Bearer ${viewerToken}` },
      });
      expect(forbidden.status).toBe(403);

      const crossOrganization = await inProcess(
        app,
        'POST',
        `/api/v1/organizations/another-org/applications/${testApplicationId}/screen`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      expect(crossOrganization.status).toBe(403);
    });
  });
});
