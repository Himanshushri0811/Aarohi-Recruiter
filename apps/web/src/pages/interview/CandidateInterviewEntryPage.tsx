import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { interviewAccessApi, type InterviewAccessValidation } from '@/lib/api';
import { Spinner } from '@/design-system';

export const CandidateInterviewEntryPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<InterviewAccessValidation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiConsent, setAiConsent] = useState(false);
  const [audioConsent, setAudioConsent] = useState(false);
  const [videoConsent, setVideoConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invalid interview link'); setLoading(false); return; }
    interviewAccessApi.validate(token)
      .then(setData)
      .catch(() => setError('This interview link is invalid, expired, or has already been used.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleBegin = async () => {
    if (!token || !aiConsent || !audioConsent || !videoConsent || !privacyConsent) return;
    setSubmitting(true);
    try {
      await interviewAccessApi.consent(token, {
        aiDisclosureAccepted: aiConsent,
        audioRecordingConsent: audioConsent,
        videoRecordingConsent: videoConsent,
      });
      navigate(`/interview/${token}/setup`);
    } catch {
      setError('Failed to record consent. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-950">
        <Spinner size="lg" className="text-white" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-950 p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Interview Link</h1>
          <p className="text-gray-500 text-sm">{error ?? 'This link is not valid.'}</p>
        </div>
      </div>
    );
  }

  const { interview, candidate, job } = data;
  if (data.alreadyCompleted || interview.status === 'COMPLETED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-950 p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Interview Already Completed</h1>
          <p className="text-gray-500 mt-2 text-sm">
            This interview attempt has been completed and its invitation link can no longer be used.
            Please contact your recruiter if you need another attempt.
          </p>
        </div>
      </div>
    );
  }

  const isExpired = new Date(interview.tokenExpiresAt) < new Date();

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-blue-950 p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-bold">Interview Link Expired</h1>
          <p className="text-gray-500 mt-2 text-sm">Please contact the recruiter for a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-lg">🎙️</span>
            </div>
            <div>
              <p className="text-blue-200 text-xs font-medium">AAROHI AI INTERVIEWER</p>
              <h1 className="text-lg font-bold">Your Interview</h1>
            </div>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-xs text-blue-200">POSITION</p>
            <p className="font-semibold">{job.title}</p>
            <p className="text-xs text-blue-200 mt-1">{job.department}</p>
          </div>
        </div>

        <div className="p-6">
          <p className="text-gray-700 mb-1">Hello, <strong>{candidate.firstName}</strong>!</p>
          <p className="text-gray-500 text-sm mb-5">
            You've been invited to a {interview.durationMinutes}-minute {interview.type.toLowerCase()} interview
            conducted by Aarohi, an AI interviewer. This is a voice-based interview — Aarohi will ask you questions
            and you'll respond verbally.
          </p>

          {/* AI Disclosure */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-amber-700 mb-2">⚠️ AI INTERVIEW DISCLOSURE</p>
            <ul className="text-xs text-amber-800 space-y-1">
              <li>• This interview is conducted by Aarohi, an AI system (not a human)</li>
              <li>• Your responses will be transcribed and analyzed by AI</li>
              <li>• A human recruiter will review the results and make all final decisions</li>
              <li>• AI evaluations are advisory only and do not automatically accept or reject you</li>
            </ul>
          </div>

          {/* Instructions */}
          {interview.instructions && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
              <p className="text-xs font-semibold text-blue-700 mb-2">INTERVIEW INSTRUCTIONS</p>
              <p className="text-xs text-blue-800">{interview.instructions}</p>
            </div>
          )}

          {/* Consent checkboxes */}
          <div className="space-y-3 mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                checked={aiConsent}
                onChange={(e) => setAiConsent(e.target.checked)}
              />
              <span className="text-sm text-gray-700">
                I understand that this interview is conducted by an AI system and that a human recruiter makes
                all final decisions.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                checked={audioConsent}
                onChange={(e) => setAudioConsent(e.target.checked)}
              />
              <span className="text-sm text-gray-700">
                I consent to my microphone audio being captured, transmitted, recorded, and transcribed for this
                interview.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                checked={videoConsent}
                onChange={(e) => setVideoConsent(e.target.checked)}
              />
              <span className="text-sm text-gray-700">
                I consent to my camera video being captured and transmitted during this interview.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                checked={privacyConsent}
                onChange={(e) => setPrivacyConsent(e.target.checked)}
              />
              <span className="text-sm text-gray-700">
                I have read and agree to the Privacy Policy and Terms of Use.
              </span>
            </label>
          </div>

          <button
            className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
              aiConsent && audioConsent && videoConsent && privacyConsent && !submitting
                ? 'bg-blue-600 hover:bg-blue-700 shadow-lg'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
            disabled={!aiConsent || !audioConsent || !videoConsent || !privacyConsent || submitting}
            onClick={handleBegin}
          >
            {submitting ? 'Processing…' : 'Begin Setup →'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            Link expires: {new Date(interview.tokenExpiresAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CandidateInterviewEntryPage;
