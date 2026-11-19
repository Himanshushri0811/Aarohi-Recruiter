import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Button, Card, CardTitle, Badge, Icon, Spinner,
} from '@/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/design-system';
import { interviewsApi, type Interview, type InterviewStatus } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

const STATUS_COLORS: Record<InterviewStatus, 'primary' | 'secondary' | 'mint' | 'warning' | 'danger' | 'outline'> = {
  DRAFT: 'outline', SCHEDULED: 'secondary', INVITED: 'primary', READY: 'warning',
  IN_PROGRESS: 'warning', PAUSED: 'outline', COMPLETED: 'mint',
  CANCELLED: 'danger', EXPIRED: 'outline', FAILED: 'danger',
};

export const InterviewDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();

  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenLoading, setRegenLoading] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(
    () => (location.state as { newInviteUrl?: string } | null)?.newInviteUrl ?? null,
  );
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<{ messageId: string; to: string } | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg || !id) return;
    try {
      const data = await interviewsApi.get(currentOrg.id, id);
      setInterview(data);
      if (data.candidate?.email) {
        setRecipientEmail(data.candidate.email);
      }
    } catch {
      showToast({ title: 'Failed to load interview', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentOrg, id, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleSendEmailInvite = async () => {
    if (!currentOrg || !id) return;
    if (!recipientEmail || !recipientEmail.includes('@')) {
      showToast({ title: 'Please provide a valid recipient email', variant: 'error' });
      return;
    }
    setSendingInvite(true);
    try {
      const res = await interviewsApi.sendInvite(currentOrg.id, id, recipientEmail);
      setInviteSuccess({ messageId: res.messageId, to: res.recipient });
      setNewInviteUrl(res.inviteUrl);
      showToast({ title: 'Interview invitation sent via Brevo!', variant: 'success' });
      load();
    } catch (err: any) {
      showToast({
        title: 'Failed to send email invitation',
        description: err.message || 'Check Brevo configuration',
        variant: 'error',
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRegenerate = async () => {
    if (!currentOrg || !id) return;
    setRegenLoading(true);
    try {
      const res = await interviewsApi.regenerateToken(currentOrg.id, id);
      setNewInviteUrl(res.inviteUrl);
      showToast({ title: 'New interview link generated', variant: 'success' });
      load();
    } catch {
      showToast({ title: 'Failed to regenerate link', variant: 'error' });
    } finally {
      setRegenLoading(false);
    }
  };

  const handleCreateAttempt = async () => {
    if (!currentOrg || !id) return;
    setAttemptLoading(true);
    try {
      const result = await interviewsApi.createAttempt(currentOrg.id, id);
      navigate(`/interviews/${result.interview.id}`, {
        state: { newInviteUrl: result.inviteUrl },
      });
      showToast({ title: 'New interview attempt created', variant: 'success' });
    } catch (err: any) {
      showToast({
        title: 'Could not create a new interview attempt',
        description: err.message || 'The current attempt may still be active.',
        variant: 'error',
      });
    } finally {
      setAttemptLoading(false);
    }
  };

  if (loading) {
    return <AppLayout><div className="flex justify-center py-24"><Spinner size="lg" /></div></AppLayout>;
  }

  if (!interview) {
    return <AppLayout><div className="p-6 text-center text-gray-500">Interview not found</div></AppLayout>;
  }

  const candidateName = interview.candidate
    ? `${interview.candidate.firstName} ${interview.candidate.lastName}`
    : '—';
  const canCreateAttempt =
    ['COMPLETED', 'CANCELLED', 'EXPIRED', 'FAILED'].includes(interview.status) ||
    new Date(interview.tokenExpiresAt) <= new Date();

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/interviews')}>
              Back
            </Button>
            <h1 className="text-2xl font-bold mt-2">{interview.title}</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant={STATUS_COLORS[interview.status] || 'outline'}>{interview.status}</Badge>
              <span className="text-gray-400 text-sm">{interview.type} · {interview.durationMinutes} min</span>
            </div>
          </div>
          {(interview.status === 'COMPLETED' || canCreateAttempt) && (
            <div className="flex gap-2">
              {canCreateAttempt && (
                <Button variant="outline" onClick={handleCreateAttempt} disabled={attemptLoading}>
                  {attemptLoading ? <Spinner size="sm" className="mr-2" /> : null}
                  Create New Attempt
                </Button>
              )}
              {interview.status === 'COMPLETED' && (
                <Button onClick={() => navigate(`/interviews/${id}/report`)}>View Report</Button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Candidate */}
          <Card className="p-4">
            <CardTitle className="text-sm text-gray-500 font-medium mb-2">CANDIDATE</CardTitle>
            <p className="font-semibold">{candidateName}</p>
            <p className="text-sm text-gray-400">{interview.candidate?.email}</p>
            <Button size="sm" variant="outline" className="mt-2"
              onClick={() => navigate(`/candidates/${interview.candidateId}`)}>
              View Profile
            </Button>
          </Card>

          {/* Job */}
          <Card className="p-4">
            <CardTitle className="text-sm text-gray-500 font-medium mb-2">JOB POSITION</CardTitle>
            <p className="font-semibold">{interview.job?.title ?? '—'}</p>
            <p className="text-sm text-gray-400">{interview.job?.department}</p>
            <Button size="sm" variant="outline" className="mt-2"
              onClick={() => navigate(`/jobs/${interview.jobId}`)}>
              View Job
            </Button>
          </Card>
        </div>

        {/* Invite Link & Email Dispatch */}
        <Card className="p-5 mb-4">
          <CardTitle className="text-sm font-medium mb-3">Candidate Invitation & Access Link</CardTitle>

          {inviteSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                <span>✅ Invitation successfully dispatched via Brevo</span>
              </div>
              <p className="text-xs text-green-600 mt-1">Recipient: {inviteSuccess.to}</p>
              <p className="text-xs text-green-600 font-mono">Brevo Message ID: {inviteSuccess.messageId}</p>
            </div>
          )}

          {newInviteUrl ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-blue-600 font-medium mb-1">INTERVIEW ACCESS URL</p>
              <p className="font-mono text-sm break-all text-blue-800">{newInviteUrl}</p>
              <Button size="sm" className="mt-2"
                onClick={() => { navigator.clipboard.writeText(newInviteUrl); showToast({ title: 'Copied!', variant: 'success' }); }}>
                Copy URL
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mb-3">
              Token status: {interview.status} · Link valid until: {new Date(interview.tokenExpiresAt).toLocaleString()}
            </p>
          )}

          {!['COMPLETED', 'IN_PROGRESS', 'PAUSED', 'CANCELLED', 'FAILED'].includes(interview.status) && (
          <div className="border-t pt-4 mt-3">
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Send Email Invitation (Brevo)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Candidate Email Address"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
              <Button
                onClick={handleSendEmailInvite}
                disabled={sendingInvite}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {sendingInvite ? <Spinner size="sm" className="mr-2" /> : <Icon name="Mail" className="mr-2" />}
                {sendingInvite ? 'Sending via Brevo…' : 'Send Invitation Email'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenLoading}>
                {regenLoading ? <Spinner size="sm" className="mr-2" /> : <Icon name="Refresh" className="mr-2" />}
                Regenerate Link
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              Dispatches an HTML interview invite with Aarohi interview instructions directly through Brevo transactional email.
            </p>
          </div>
          )}
          {['IN_PROGRESS', 'PAUSED'].includes(interview.status) && (
            <p className="mt-3 text-xs text-gray-500">
              This interview is active. The candidate can reconnect using the existing invitation link.
            </p>
          )}
          {interview.status === 'COMPLETED' && (
            <p className="mt-3 text-xs text-gray-500">
              This invitation link has been permanently closed. Create a new attempt to issue a fresh URL.
            </p>
          )}
        </Card>

        {/* Instructions */}
        {interview.instructions && (
          <Card className="p-4 mb-4">
            <CardTitle className="text-sm font-medium mb-2">Instructions for Aarohi</CardTitle>
            <p className="text-sm text-gray-600 whitespace-pre-line">{interview.instructions}</p>
          </Card>
        )}

        {/* Questions */}
        {interview.questions && interview.questions.length > 0 && (
          <Card className="p-4 mb-4">
            <CardTitle className="text-sm font-medium mb-3">Questions ({interview.questions.length})</CardTitle>
            <div className="space-y-3">
              {interview.questions.map((q, i) => (
                <div key={q.id} className="border rounded-lg p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <span className="text-xs text-gray-400 font-medium">Q{i + 1} · {q.category}</span>
                      <p className="text-sm mt-1">{q.text}</p>
                    </div>
                    <Badge variant={q.status === 'ANSWERED' ? 'mint' : 'outline'} className="ml-2">
                      {q.status}
                    </Badge>
                  </div>
                  {q.answer && (
                    <div className="mt-2 bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-500 font-medium mb-1">ANSWER</p>
                      <p className="text-sm text-gray-700">{q.answer.transcript}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Evaluation summary */}
        {interview.evaluation && (
          <Card className="p-4 mb-4">
            <CardTitle className="text-sm font-medium mb-3">AI Evaluation (Advisory)</CardTitle>
            <div className="flex items-center gap-4 mb-3">
              <div className="text-3xl font-bold text-blue-600">
                {interview.evaluation.overallScore?.toFixed(0) ?? '—'}
              </div>
              <div>
                <p className="text-xs text-gray-500">Overall Score / 100</p>
                <Badge variant="secondary">{interview.evaluation.recommendation ?? 'PENDING'}</Badge>
              </div>
            </div>
            <p className="text-sm text-gray-600">{interview.evaluation.summary}</p>
            <Button className="mt-3" variant="outline" onClick={() => navigate(`/interviews/${id}/report`)}>
              View Full Report
            </Button>
          </Card>
        )}

        {/* Recruiter Decision */}
        {interview.recruiterDecision && (
          <Card className="p-4">
            <CardTitle className="text-sm font-medium mb-2">Recruiter Decision</CardTitle>
            <Badge variant={interview.recruiterDecision === 'ADVANCE' ? 'mint' : 'danger'}>
              {interview.recruiterDecision}
            </Badge>
            {interview.decisionNotes && (
              <p className="text-sm text-gray-600 mt-2">{interview.decisionNotes}</p>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default InterviewDetailPage;
