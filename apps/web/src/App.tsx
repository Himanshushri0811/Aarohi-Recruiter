import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/design-system/components/Toast';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PublicRoute } from '@/components/auth/PublicRoute';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { OrganizationSetupPage } from '@/pages/OrganizationSetupPage';
import { DashboardPage } from '@/pages/DashboardPage';

import { JobListPage } from '@/pages/jobs/JobListPage';
import { JobCreatePage } from '@/pages/jobs/JobCreatePage';
import { JobDetailPage } from '@/pages/jobs/JobDetailPage';

import { CandidateListPage } from '@/pages/candidates/CandidateListPage';
import { CandidateCreatePage } from '@/pages/candidates/CandidateCreatePage';
import { CandidateDetailPage } from '@/pages/candidates/CandidateDetailPage';
import { ApplicationDetailPage } from '@/pages/applications/ApplicationDetailPage';

import { InterviewListPage } from '@/pages/interviews/InterviewListPage';
import { InterviewCreatePage } from '@/pages/interviews/InterviewCreatePage';
import { InterviewDetailPage } from '@/pages/interviews/InterviewDetailPage';
import { InterviewReportPage } from '@/pages/interviews/InterviewReportPage';

import { CandidateInterviewEntryPage } from '@/pages/interview/CandidateInterviewEntryPage';
import { CandidateDeviceCheckPage } from '@/pages/interview/CandidateDeviceCheckPage';
import { CandidateVideoInterviewPage } from '@/pages/interview/CandidateVideoInterviewPage';
import { CandidateInterviewCompletedPage } from '@/pages/interview/CandidateInterviewCompletedPage';

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgotPasswordPage />
                </PublicRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <PublicRoute>
                  <ResetPasswordPage />
                </PublicRoute>
              }
            />

            {/* Protected Routes */}
            <Route
              path="/org/new"
              element={
                <ProtectedRoute>
                  <OrganizationSetupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            {/* Recruitment: Jobs */}
            <Route
              path="/jobs"
              element={
                <ProtectedRoute>
                  <JobListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/new"
              element={
                <ProtectedRoute>
                  <JobCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/:id"
              element={
                <ProtectedRoute>
                  <JobDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/:id/edit"
              element={
                <ProtectedRoute>
                  <JobCreatePage />
                </ProtectedRoute>
              }
            />

            {/* Recruitment: Candidates */}
            <Route
              path="/candidates"
              element={
                <ProtectedRoute>
                  <CandidateListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/candidates/new"
              element={
                <ProtectedRoute>
                  <CandidateCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/candidates/:id"
              element={
                <ProtectedRoute>
                  <CandidateDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applications/:id"
              element={
                <ProtectedRoute>
                  <ApplicationDetailPage />
                </ProtectedRoute>
              }
            />

            {/* Candidate Public Interview Routes (No Recruiter Nav/AppLayout) */}
            <Route path="/interview/:token" element={<CandidateInterviewEntryPage />} />
            <Route path="/interview/:token/setup" element={<CandidateDeviceCheckPage />} />
            <Route path="/interview/:token/live" element={<CandidateVideoInterviewPage />} />
            <Route path="/interview/:token/done" element={<CandidateInterviewCompletedPage />} />

            {/* Recruitment: Interviews */}
            <Route
              path="/interviews"
              element={
                <ProtectedRoute>
                  <InterviewListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interviews/new"
              element={
                <ProtectedRoute>
                  <InterviewCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interviews/:id"
              element={
                <ProtectedRoute>
                  <InterviewDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interviews/:id/report"
              element={
                <ProtectedRoute>
                  <InterviewReportPage />
                </ProtectedRoute>
              }
            />

            {/* Default Root Redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
