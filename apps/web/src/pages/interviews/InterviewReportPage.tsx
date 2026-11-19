import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, CardTitle, Badge, Spinner } from '@/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/design-system';
import { interviewsApi, type Interview, type RecruiterDecision } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

const DECISIONS: { value: RecruiterDecision; label: string; color: string }[] = [
  { value: 'ADVANCE', label: '✅ Advance', color: 'bg-green-600 hover:bg-green-700 text-white' },
  { value: 'HOLD', label: '⏸ Hold', color: 'bg-yellow-500 hover:bg-yellow-600 text-white' },
  { value: 'REJECT', label: '❌ Reject', color: 'bg-red-600 hover:bg-red-700 text-white' },
  { value: 'REQUEST_INTERVIEW', label: '🔄 Request Another', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
];

export const InterviewReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();

  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [savingDecision, setSavingDecision] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrg || !id) return;
    try {
      const data = await interviewsApi.get(currentOrg.id, id);
      setInterview(data);
      if (data.decisionNotes) setDecisionNotes(data.decisionNotes);
    } catch {
      showToast({ title: 'Failed to load report', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentOrg, id, showToast]);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async (decision: RecruiterDecision) => {
    if (!currentOrg || !id) return;
    setSavingDecision(true);
    try {
      await interviewsApi.recordDecision(currentOrg.id, id, decision, decisionNotes);
      showToast({ title: `Decision recorded: ${decision}`, variant: 'success' });
      load();
    } catch {
      showToast({ title: 'Failed to save decision', variant: 'error' });
    } finally {
      setSavingDecision(false);
    }
  };

  if (loading) {
    return <AppLayout><div className="flex justify-center py-24"><Spinner size="lg" /></div></AppLayout>;
  }

  if (!interview) {
    return <AppLayout><div className="p-6 text-center">Interview not found</div></AppLayout>;
  }

  const { evaluation, questions, events, candidate, job } = interview;

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/interviews/${id}`)}>
            Back to Interview
          </Button>
          <h1 className="text-2xl font-bold mt-2">Interview Report</h1>
          <p className="text-gray-500">
            {candidate ? `${candidate.firstName} ${candidate.lastName}` : '—'} · {job?.title}
          </p>
        </div>

        {/* AI Evaluation */}
        {evaluation ? (
          <>
            <Card className="p-6 mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <CardTitle>AI Evaluation</CardTitle>
                  <p className="text-xs text-gray-400 mt-1">Advisory only — you make the final call</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold text-blue-600">
                    {evaluation.overallScore?.toFixed(0) ?? '—'}
                  </div>
                  <p className="text-xs text-gray-500">/ 100</p>
                  {evaluation.recommendation && (
                    <Badge variant="secondary" className="mt-1">{evaluation.recommendation}</Badge>
                  )}
                </div>
              </div>
              <p className="text-gray-700 text-sm mb-4">{evaluation.summary}</p>

              {/* Rubric scores */}
              {evaluation.rubricScores && Object.keys(evaluation.rubricScores).length > 0 && (
                <div className="space-y-3 mb-4">
                  <p className="text-sm font-medium">Rubric Breakdown</p>
                  {Object.entries(evaluation.rubricScores).map(([key, val]) => {
                    const v = val as { score: number; evidence?: string; notes?: string };
                    return (
                      <div key={key} className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium capitalize">
                            {key.replace(/([A-Z])/g, ' $1')}
                          </span>
                          <span className="font-bold text-blue-600">{v.score}/10</span>
                        </div>
                        {v.evidence && <p className="text-xs text-gray-500 italic">"{v.evidence}"</p>}
                        {v.notes && <p className="text-xs text-gray-400 mt-1">{v.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(evaluation.strengths || []).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-green-700 mb-2">✅ Strengths</p>
                    <ul className="space-y-1">
                      {(evaluation.strengths || []).map((s, i) => (
                        <li key={i} className="text-sm text-gray-600">• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(evaluation.weaknesses || []).length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-red-700 mb-2">⚠️ Areas for Development</p>
                    <ul className="space-y-1">
                      {(evaluation.weaknesses || []).map((w, i) => (
                        <li key={i} className="text-sm text-gray-600">• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {(evaluation.areasToClarify || []).length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-blue-700 mb-2">🔍 Areas to Clarify Further</p>
                  <ul className="space-y-1">
                    {(evaluation.areasToClarify || []).map((a, i) => (
                      <li key={i} className="text-sm text-gray-600">• {a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </>
        ) : (
          <Card className="p-6 mb-4 text-center text-gray-400">
            <p>Evaluation not yet generated</p>
          </Card>
        )}

        {/* Transcript */}
        {questions && questions.length > 0 && (
          <Card className="p-6 mb-4">
            <CardTitle className="mb-4">Interview Transcript</CardTitle>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id} className="border-l-4 border-blue-200 pl-4">
                  <p className="text-xs text-gray-400 font-medium">Q{i + 1} · {q.category}</p>
                  <p className="text-sm font-medium mt-1 text-gray-800">{q.text}</p>
                  {q.answer ? (
                    <div className="mt-2 bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-400 mb-1">CANDIDATE</p>
                      <p className="text-sm text-gray-700">{q.answer.transcript}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic mt-1">No answer recorded</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Integrity Events */}
        {events && events.length > 0 && (
          <Card className="p-6 mb-4">
            <CardTitle className="mb-3">Integrity Events ({events.length})</CardTitle>
            <div className="space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 text-sm">
                  <span className="text-yellow-600">⚡</span>
                  <span className="font-mono text-xs text-gray-500">{new Date(ev.createdAt).toLocaleTimeString()}</span>
                  <span className="text-gray-700">{ev.eventType}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Recruiter Decision */}
        <Card className="p-6">
          <CardTitle className="mb-2">Recruiter Decision</CardTitle>
          <p className="text-sm text-gray-500 mb-4">
            This decision is yours to make. The AI evaluation above is advisory only.
          </p>

          {interview.recruiterDecision ? (
            <div>
              <Badge variant={interview.recruiterDecision === 'ADVANCE' ? 'mint' : 'danger'}>
                {interview.recruiterDecision}
              </Badge>
              {interview.decisionNotes && (
                <p className="text-sm text-gray-600 mt-2">{interview.decisionNotes}</p>
              )}
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setInterview({ ...interview, recruiterDecision: undefined })}>
                Change Decision
              </Button>
            </div>
          ) : (
            <>
              <textarea
                className="w-full border rounded-md px-3 py-2 text-sm h-20 resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Notes (optional)…"
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DECISIONS.map((d) => (
                  <button
                    key={d.value}
                    className={`rounded-lg py-2 px-3 text-sm font-medium transition-colors ${d.color} disabled:opacity-50`}
                    onClick={() => handleDecision(d.value)}
                    disabled={savingDecision}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default InterviewReportPage;
