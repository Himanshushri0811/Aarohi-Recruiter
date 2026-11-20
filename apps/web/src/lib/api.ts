/// <reference types="vite/client" />

const API_BASE = import.meta.env.VITE_API_URL || 'https://aarohi-recruiter.onrender.com/api/v1';

// In-memory access token storage (never localStorage to prevent XSS exfiltration)
let _accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Array<{ field?: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
    details?: Array<{ field?: string; message: string }>;
  };
}

export interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  logoUrl?: string | null;
  role?: string;
  createdAt: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateOrgInput {
  name: string;
  slug?: string;
}

// ---------------------------------------------------------------------------
// Recruitment workflow types
// ---------------------------------------------------------------------------

export type JobStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'CLOSED';

export interface Job {
  id: string;
  organizationId: string;
  title: string;
  department: string;
  location?: string | null;
  employmentType?: string | null;
  experienceLevel?: string | null;
  status: JobStatus;
  description: string;
  requirements?: string | null;
  responsibilities?: string | null;
  skills: string[];
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { applications: number };
}

export interface CreateJobInput {
  title: string;
  department: string;
  description: string;
  location?: string;
  employmentType?: string;
  experienceLevel?: string;
  status?: JobStatus;
  requirements?: string;
  responsibilities?: string;
  skills?: string[];
}

export type UpdateJobInput = Partial<CreateJobInput>;

export type CandidateStatus = 'NEW' | 'ACTIVE' | 'ARCHIVED';

export interface Candidate {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  location?: string | null;
  headline?: string | null;
  summary?: string | null;
  skills: string[];
  experienceYears?: number | null;
  status: CandidateStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  resumes?: Resume[];
  _count?: { resumes: number; applications: number };
}

export interface CreateCandidateInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  location?: string;
  headline?: string;
  summary?: string;
  skills?: string[];
  experienceYears?: number;
}

export type UpdateCandidateInput = Partial<CreateCandidateInput>;

export type ResumeParsingStatus = 'PENDING' | 'PARSED' | 'FAILED';

export interface Resume {
  id: string;
  candidateId: string;
  organizationId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storageKey: string;
  extractedText?: string | null;
  parsingStatus: ResumeParsingStatus;
  parsedData?: {
    name?: string;
    email?: string;
    phone?: string;
    skills?: string[];
    experienceYears?: number;
    educationSummary?: string;
    rawText?: string;
  } | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_COMPLETED'
  | 'OFFERED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface ResumeEvidenceFinding {
  title: string;
  status:
    | 'demonstrated'
    | 'partial'
    | 'not_evidenced'
    | 'insufficient_evidence'
    | 'not_applicable';
  summary: string;
  resumeEvidence: string[];
  jobEvidence: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface ResumeSkillAssessment extends ResumeEvidenceFinding {
  skill: string;
}

export interface ResumeMatchReport {
  matchScore: number | null;
  analysisConfidence: 'high' | 'medium' | 'low';
  insufficientInformation: boolean;
  fitSummary: string;
  requiredSkills: ResumeSkillAssessment[];
  preferredSkills: ResumeSkillAssessment[];
  experienceAssessment: ResumeEvidenceFinding;
  projectAssessments: ResumeEvidenceFinding[];
  educationAssessment: ResumeEvidenceFinding;
  missingQualifications: ResumeEvidenceFinding[];
  strengths: ResumeEvidenceFinding[];
  gaps: ResumeEvidenceFinding[];
  suggestedInterviewTopics: string[];
}

export interface ApplicationScreeningState {
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  requestId?: string;
  analysisId?: string;
  analyzedAt?: string;
  report?: ResumeMatchReport;
  message?: string;
}

export interface ResumeScreeningResult {
  applicationId: string;
  analysisId: string;
  analyzedAt: string;
  report: ResumeMatchReport;
}

export interface Application {
  id: string;
  organizationId: string;
  jobId: string;
  candidateId: string;
  resumeId?: string | null;
  status: ApplicationStatus;
  stage: string;
  matchScore?: number | null;
  analysis?: ApplicationScreeningState | null;
  createdAt: string;
  updatedAt: string;
  job?: Partial<Job>;
  candidate?: Partial<Candidate>;
  resume?: Partial<Resume>;
}

export interface CreateApplicationInput {
  jobId: string;
  candidateId: string;
  resumeId?: string;
  stage?: string;
}

export interface OrgStats {
  jobs: number;
  candidates: number;
  applications: number;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (_accessToken) {
    headers['Authorization'] = `Bearer ${_accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // sends and receives httpOnly refresh cookies
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok || data.success === false) {
    const error = data.error || {};
    throw new ApiError(
      error.message || `Request failed with status ${response.status}`,
      response.status,
      error.code,
      error.details,
    );
  }

  return data.data as T;
}

export interface RegisterResponse {
  message: string;
  user: User;
  devVerificationToken?: string;
  devVerificationUrl?: string;
}

export interface VerifyEmailResponse {
  message: string;
  alreadyVerified?: boolean;
}

export interface ResendVerificationResponse {
  message: string;
  alreadyVerified?: boolean;
  devVerificationToken?: string;
  devVerificationUrl?: string;
}

export const authApi = {
  register: (body: RegisterInput) =>
    request<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: LoginInput) =>
    request<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  verifyEmail: (token: string) =>
    request<VerifyEmailResponse>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  resendVerification: (email: string) =>
    request<ResendVerificationResponse>('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  refresh: () =>
    request<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
    }),

  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
};

export const organizationApi = {
  list: () => request<Organization[]>('/organizations'),

  create: (body: CreateOrgInput) =>
    request<Organization>('/organizations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  get: (orgId: string) => request<Organization>(`/organizations/${orgId}`),

  update: (orgId: string, body: Partial<CreateOrgInput>) =>
    request<Organization>(`/organizations/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const jobsApi = {
  list: (orgId: string, params?: { status?: string; search?: string }) => {
    const qs = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
        ).toString()
      : '';
    return request<Job[]>(`/organizations/${orgId}/jobs${qs}`);
  },

  create: (orgId: string, body: CreateJobInput) =>
    request<Job>(`/organizations/${orgId}/jobs`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  get: (orgId: string, jobId: string) =>
    request<Job>(`/organizations/${orgId}/jobs/${jobId}`),

  update: (orgId: string, jobId: string, body: UpdateJobInput) =>
    request<Job>(`/organizations/${orgId}/jobs/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  updateStatus: (orgId: string, jobId: string, status: JobStatus) =>
    request<Job>(`/organizations/${orgId}/jobs/${jobId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  delete: (orgId: string, jobId: string) =>
    request<{ success: boolean }>(`/organizations/${orgId}/jobs/${jobId}`, {
      method: 'DELETE',
    }),
};

export const candidatesApi = {
  list: (orgId: string, params?: { status?: string; search?: string }) => {
    const qs = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
        ).toString()
      : '';
    return request<Candidate[]>(`/organizations/${orgId}/candidates${qs}`);
  },

  create: (orgId: string, body: CreateCandidateInput) =>
    request<Candidate>(`/organizations/${orgId}/candidates`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  get: (orgId: string, candidateId: string) =>
    request<Candidate>(`/organizations/${orgId}/candidates/${candidateId}`),

  update: (orgId: string, candidateId: string, body: UpdateCandidateInput) =>
    request<Candidate>(`/organizations/${orgId}/candidates/${candidateId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  archive: (orgId: string, candidateId: string) =>
    request<Candidate>(`/organizations/${orgId}/candidates/${candidateId}/archive`, {
      method: 'PATCH',
    }),

  uploadResume: (orgId: string, candidateId: string, file: File) => {
    const formData = new FormData();
    formData.append('resume', file);
    return request<Resume>(`/organizations/${orgId}/candidates/${candidateId}/resumes`, {
      method: 'POST',
      body: formData,
    });
  },

  listResumes: (orgId: string, candidateId: string) =>
    request<Resume[]>(`/organizations/${orgId}/candidates/${candidateId}/resumes`),

  deleteResume: (orgId: string, candidateId: string, resumeId: string) =>
    request<{ success: boolean }>(
      `/organizations/${orgId}/candidates/${candidateId}/resumes/${resumeId}`,
      { method: 'DELETE' },
    ),
};

export const applicationsApi = {
  list: (orgId: string, params?: { jobId?: string; candidateId?: string; status?: string }) => {
    const qs = params
      ? '?' +
        new URLSearchParams(
          Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
        ).toString()
      : '';
    return request<Application[]>(`/organizations/${orgId}/applications${qs}`);
  },

  create: (orgId: string, body: CreateApplicationInput) =>
    request<Application>(`/organizations/${orgId}/applications`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  get: (orgId: string, applicationId: string) =>
    request<Application>(`/organizations/${orgId}/applications/${applicationId}`),

  updateStatus: (
    orgId: string,
    applicationId: string,
    status: ApplicationStatus,
    stage?: string,
  ) =>
    request<Application>(`/organizations/${orgId}/applications/${applicationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, stage }),
    }),

  screen: (orgId: string, applicationId: string) =>
    request<ResumeScreeningResult>(
      `/organizations/${orgId}/applications/${applicationId}/screen`,
      { method: 'POST' },
    ),
};

export const statsApi = {
  get: (orgId: string) => request<OrgStats>(`/organizations/${orgId}/stats`),
};

// ---------------------------------------------------------------------------
// Interview Types
// ---------------------------------------------------------------------------

export type InterviewStatus =
  | 'DRAFT' | 'SCHEDULED' | 'INVITED' | 'READY' | 'IN_PROGRESS'
  | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

export type InterviewType = 'TECHNICAL' | 'BEHAVIORAL' | 'SCREENING' | 'COMPREHENSIVE';

export type RecruiterDecision = 'ADVANCE' | 'HOLD' | 'REJECT' | 'REQUEST_INTERVIEW';

export interface Interview {
  id: string;
  organizationId: string;
  jobId: string;
  candidateId: string;
  applicationId?: string;
  title: string;
  type: InterviewType;
  status: InterviewStatus;
  language: string;
  durationMinutes: number;
  instructions?: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  tokenExpiresAt: string;
  recruiterDecision?: RecruiterDecision;
  decisionNotes?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
  candidate?: { id: string; firstName: string; lastName: string; email: string };
  job?: { id: string; title: string; department: string };
  evaluation?: InterviewEvaluation | null;
  questions?: InterviewQuestion[];
  events?: InterviewEvent[];
  consent?: InterviewConsent | null;
}

export interface InterviewQuestion {
  id: string;
  interviewId: string;
  order: number;
  text: string;
  topic?: string;
  category: string;
  status: string;
  answer?: InterviewAnswer | null;
}

export interface InterviewAnswer {
  id: string;
  questionId: string;
  transcript: string;
  durationSeconds?: number;
  submittedAt: string;
}

export interface InterviewEvent {
  id: string;
  interviewId: string;
  eventType: string;
  durationMs?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface InterviewConsent {
  id: string;
  aiDisclosureAccepted: boolean;
  audioRecordingConsent: boolean;
  videoRecordingConsent: boolean;
  consentedAt: string;
}

export interface InterviewEvaluation {
  id: string;
  overallScore?: number;
  recommendation?: string;
  summary: string;
  rubricScores: Record<string, unknown>;
  strengths: string[];
  weaknesses: string[];
  areasToClarify: string[];
}

export interface CreateInterviewPayload {
  candidateId: string;
  jobId: string;
  applicationId?: string;
  type?: InterviewType;
  scheduledAt?: string;
  durationMinutes?: number;
  language?: string;
  instructions?: string;
  tokenExpiryHours?: number;
  title?: string;
}

export interface ListInterviewsParams {
  status?: InterviewStatus;
  jobId?: string;
  candidateId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedInterviews {
  data: Interview[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface InterviewAccessValidation {
  interview: {
    id: string;
    title: string;
    type: InterviewType;
    status: InterviewStatus;
    language: string;
    durationMinutes: number;
    instructions?: string;
    tokenExpiresAt: string;
    hasConsented: boolean;
    consent: {
      aiDisclosureAccepted: boolean;
      audioRecordingConsent: boolean;
      videoRecordingConsent: boolean;
    };
    startedAt?: string | null;
    currentQuestionIndex: number;
    sessionHistory: Array<{
      questionNumber: number;
      questionText: string;
      transcript: string | null;
    }>;
  };
  candidate: { id: string; firstName: string };
  job: { id: string; title: string; department: string };
  alreadyCompleted?: boolean;
}

// ---------------------------------------------------------------------------
// Interview API (recruiter-facing, authenticated)
// ---------------------------------------------------------------------------

export const interviewsApi = {
  list: (orgId: string, params?: ListInterviewsParams) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString() : '';
    return request<Interview[]>(`/organizations/${orgId}/interviews${qs}`);
  },

  create: (orgId: string, body: CreateInterviewPayload) =>
    request<{ interview: Interview; inviteUrl: string; accessToken: string }>(
      `/organizations/${orgId}/interviews`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  createAttempt: (orgId: string, interviewId: string) =>
    request<{ interview: Interview; inviteUrl: string; accessToken: string }>(
      `/organizations/${orgId}/interviews/${interviewId}/attempt`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  get: (orgId: string, interviewId: string) =>
    request<Interview>(`/organizations/${orgId}/interviews/${interviewId}`),

  update: (orgId: string, interviewId: string, body: Partial<CreateInterviewPayload> & { status?: InterviewStatus }) =>
    request<Interview>(`/organizations/${orgId}/interviews/${interviewId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  recordDecision: (orgId: string, interviewId: string, decision: RecruiterDecision, notes?: string) =>
    request<Interview>(`/organizations/${orgId}/interviews/${interviewId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, notes }),
    }),

  regenerateToken: (orgId: string, interviewId: string, expiryHours?: number) =>
    request<{ inviteUrl: string; accessToken: string; expiresAt: string }>(
      `/organizations/${orgId}/interviews/${interviewId}/regenerate-token`,
      { method: 'POST', body: JSON.stringify({ expiryHours }) },
    ),

  sendInvite: (orgId: string, interviewId: string, recipientEmail?: string) =>
    request<{ emailSent: boolean; messageId: string; recipient: string; inviteUrl: string }>(
      `/organizations/${orgId}/interviews/${interviewId}/send-invite`,
      { method: 'POST', body: JSON.stringify({ recipientEmail }) },
    ),
};

// ---------------------------------------------------------------------------
// Interview Access API (public, candidate-facing)
// ---------------------------------------------------------------------------

export const interviewAccessApi = {
  validate: (token: string) =>
    request<InterviewAccessValidation>(`/interview/validate/${token}`),

  getLiveKitToken: (token: string) =>
    request<{ livekitUrl: string | null; roomName: string; participantToken: string | null; isConfigured: boolean }>(
      `/interview/${token}/livekit`,
    ),

  consent: (token: string, body: {
    aiDisclosureAccepted: boolean;
    audioRecordingConsent: boolean;
    videoRecordingConsent: boolean;
  }) =>
    request<void>(`/interview/${token}/consent`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  recordEvent: (token: string, eventType: string, metadata?: Record<string, unknown>) =>
    request<void>(`/interview/${token}/event`, {
      method: 'POST',
      body: JSON.stringify({ eventType, metadata }),
    }),

  recordAnswer: (
    token: string,
    body: {
      questionNumber: number;
      questionText: string;
      audioBase64: string;
      mimeType?: string;
    },
  ) =>
    request<{
      transcript: string;
      nextQuestion?: string;
      audioBase64?: string;
      interviewComplete: boolean;
      followUp?: string;
    }>(`/interview/${token}/answer`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  start: (token: string) =>
    request<{
      greeting: string;
      firstQuestion: string;
      audioBase64: string;
      questionId?: string;
    }>(`/interview/${token}/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};
