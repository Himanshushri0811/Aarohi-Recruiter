import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card,
  Input, Spinner, Icon,
} from '@/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/design-system';
import {
  interviewsApi, jobsApi, candidatesApi,
  type Job, type Candidate, type InterviewType, type CreateInterviewPayload,
} from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

const INTERVIEW_TYPES: InterviewType[] = ['TECHNICAL', 'BEHAVIORAL', 'SCREENING', 'COMPREHENSIVE'];

export const InterviewCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<CreateInterviewPayload>({
    candidateId: '',
    jobId: '',
    type: 'TECHNICAL',
    durationMinutes: 30,
    language: 'en',
    instructions: '',
    tokenExpiryHours: 72,
  });

  const [result, setResult] = useState<{ inviteUrl: string; accessToken: string } | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    Promise.all([
      jobsApi.list(currentOrg.id),
      candidatesApi.list(currentOrg.id),
    ]).then(([jobRes, candRes]) => {
      setJobs(Array.isArray(jobRes) ? jobRes : ((jobRes as any)?.data || []));
      setCandidates(Array.isArray(candRes) ? candRes : ((candRes as any)?.data || []));
    }).catch(() => {
      showToast({ title: 'Failed to load data', variant: 'error' });
    }).finally(() => setLoading(false));
  }, [currentOrg, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    if (!form.candidateId || !form.jobId) {
      showToast({ title: 'Please select a candidate and job', variant: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await interviewsApi.create(currentOrg.id, form);
      setResult({ inviteUrl: res.inviteUrl, accessToken: res.accessToken });
      showToast({ title: 'Interview created successfully!', variant: 'success' });
    } catch (err: unknown) {
      showToast({ title: 'Failed to create interview', description: String(err), variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <AppLayout><div className="flex justify-center py-24"><Spinner size="lg" /></div></AppLayout>;
  }

  if (result) {
    return (
      <AppLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <Card className="p-6">
            <div className="text-center mb-6">
              <div className="rounded-full bg-green-100 p-4 inline-flex mb-4">
                <Icon name="Success" className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Interview Created!</h2>
              <p className="text-gray-500 mt-2">Share this link with the candidate.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-500 mb-1 font-medium">CANDIDATE INTERVIEW LINK</p>
              <p className="font-mono text-sm break-all text-blue-700">{result.inviteUrl}</p>
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => { navigator.clipboard.writeText(result.inviteUrl); showToast({ title: 'Copied!', variant: 'success' }); }}
              >
                Copy Link
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => navigate('/interviews')}>
                View All Interviews
              </Button>
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
              ⚠️ This token is shown only once. Store it safely.
            </p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/interviews')}>
            Back to Interviews
          </Button>
          <h1 className="text-2xl font-bold mt-2">Create Interview</h1>
          <p className="text-gray-500">Set up a new AI interview session for a candidate</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Candidate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Candidate <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.candidateId}
                onChange={(e) => setForm((f) => ({ ...f, candidateId: e.target.value }))}
                required
              >
                <option value="">Select candidate…</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} — {c.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Job */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Position <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.jobId}
                onChange={(e) => setForm((f) => ({ ...f, jobId: e.target.value }))}
                required
              >
                <option value="">Select job…</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title} — {j.department}
                  </option>
                ))}
              </select>
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Interview Type</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as InterviewType }))}
              >
                {INTERVIEW_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <Input
                type="number"
                min={10}
                max={120}
                value={form.durationMinutes}
                onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select
                className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.language}
                onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hi-IN">Hinglish</option>
              </select>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Instructions (optional)
              </label>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Any specific topics or instructions for Aarohi…"
                value={form.instructions}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              />
            </div>

            {/* Token Expiry */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Link Expiry (hours)
              </label>
              <Input
                type="number"
                min={1}
                max={168}
                value={form.tokenExpiryHours}
                onChange={(e) => setForm((f) => ({ ...f, tokenExpiryHours: Number(e.target.value) }))}
              />
              <p className="text-xs text-gray-400 mt-1">
                The interview link will expire after this many hours (default: 72h / 3 days)
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Spinner size="sm" className="mr-2" /> : null}
              {submitting ? 'Creating Interview…' : 'Create Interview & Generate Link'}
            </Button>
          </form>
        </Card>
      </div>
    </AppLayout>
  );
};

export default InterviewCreatePage;
