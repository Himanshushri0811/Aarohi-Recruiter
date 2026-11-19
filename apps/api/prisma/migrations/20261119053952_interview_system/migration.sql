-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'INVITED', 'READY', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('TECHNICAL', 'BEHAVIORAL', 'SCREENING', 'COMPREHENSIVE');

-- CreateEnum
CREATE TYPE "QuestionCategory" AS ENUM ('INTRODUCTORY', 'RESUME_BASED', 'JOB_BASED', 'TECHNICAL', 'SCENARIO', 'FOLLOW_UP', 'CANDIDATE_QUESTION');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PENDING', 'ASKED', 'ANSWERED', 'TIMED_OUT', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EvaluationRecommendation" AS ENUM ('STRONG_HIRE', 'HIRE', 'CONSIDER', 'NO_HIRE');

-- CreateEnum
CREATE TYPE "RecruiterDecision" AS ENUM ('ADVANCE', 'HOLD', 'REJECT', 'REQUEST_INTERVIEW');

-- CreateTable
CREATE TABLE "resume_analyses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobId" TEXT,
    "matchScore" DOUBLE PRECISION,
    "technicalAlignment" JSONB,
    "structuredData" JSONB NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gaps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestedTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidence" JSONB,
    "rubricDetails" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resume_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "applicationId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "type" "InterviewType" NOT NULL DEFAULT 'TECHNICAL',
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "language" TEXT NOT NULL DEFAULT 'en',
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "questionTimeoutSeconds" INTEGER NOT NULL DEFAULT 120,
    "instructions" TEXT,
    "accessTokenHash" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "tokenRevokedAt" TIMESTAMP(3),
    "livekitRoomName" TEXT NOT NULL,
    "currentQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recruiterDecision" "RecruiterDecision",
    "decisionNotes" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_questions" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "topic" TEXT,
    "category" "QuestionCategory" NOT NULL DEFAULT 'TECHNICAL',
    "expectedPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "QuestionStatus" NOT NULL DEFAULT 'PENDING',
    "askedAt" TIMESTAMP(3),
    "deadlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_answers" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "audioStorageKey" TEXT,
    "transcript" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "latencyMs" INTEGER,
    "isFollowUpGenerated" BOOLEAN NOT NULL DEFAULT false,
    "followUpQuestion" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_events" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "durationMs" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "recovered" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_consents" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "aiDisclosureAccepted" BOOLEAN NOT NULL DEFAULT true,
    "audioRecordingConsent" BOOLEAN NOT NULL DEFAULT false,
    "videoRecordingConsent" BOOLEAN NOT NULL DEFAULT false,
    "privacyPolicyVersion" TEXT NOT NULL DEFAULT '1.0',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_evaluations" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION,
    "recommendation" "EvaluationRecommendation",
    "summary" TEXT NOT NULL,
    "rubricScores" JSONB NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "areasToClarify" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interview_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resume_analyses_organizationId_idx" ON "resume_analyses"("organizationId");

-- CreateIndex
CREATE INDEX "resume_analyses_resumeId_idx" ON "resume_analyses"("resumeId");

-- CreateIndex
CREATE INDEX "resume_analyses_jobId_idx" ON "resume_analyses"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_accessTokenHash_key" ON "interviews"("accessTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_livekitRoomName_key" ON "interviews"("livekitRoomName");

-- CreateIndex
CREATE INDEX "interviews_organizationId_status_idx" ON "interviews"("organizationId", "status");

-- CreateIndex
CREATE INDEX "interviews_jobId_idx" ON "interviews"("jobId");

-- CreateIndex
CREATE INDEX "interviews_candidateId_idx" ON "interviews"("candidateId");

-- CreateIndex
CREATE INDEX "interviews_accessTokenHash_idx" ON "interviews"("accessTokenHash");

-- CreateIndex
CREATE INDEX "interview_questions_interviewId_status_idx" ON "interview_questions"("interviewId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "interview_questions_interviewId_order_key" ON "interview_questions"("interviewId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "interview_answers_questionId_key" ON "interview_answers"("questionId");

-- CreateIndex
CREATE INDEX "interview_events_interviewId_createdAt_idx" ON "interview_events"("interviewId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "interview_consents_interviewId_key" ON "interview_consents"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "interview_evaluations_interviewId_key" ON "interview_evaluations"("interviewId");

-- AddForeignKey
ALTER TABLE "resume_analyses" ADD CONSTRAINT "resume_analyses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_analyses" ADD CONSTRAINT "resume_analyses_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_analyses" ADD CONSTRAINT "resume_analyses_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "interview_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_events" ADD CONSTRAINT "interview_events_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_consents" ADD CONSTRAINT "interview_consents_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_evaluations" ADD CONSTRAINT "interview_evaluations_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
