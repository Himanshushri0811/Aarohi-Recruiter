import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Spinner,
} from '@/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/design-system';
import {
  applicationsApi,
  type Application,
  type ResumeScreeningResult,
} from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { ResumeMatchReport } from '@/components/applications/ResumeMatchReport';

export const ApplicationDetailPage: React.FC = () => {
  const { id: applicationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [screening, setScreening] = useState(false);

  const loadApplication = useCallback(async () => {
    if (!applicationId || !currentOrg?.id) return;
    try {
      setLoading(true);
      setApplication(await applicationsApi.get(currentOrg.id, applicationId));
    } catch (error: any) {
      showToast({
        title: 'Failed to load application',
        description: error.message,
        variant: 'destructive',
      });
      navigate('/candidates');
    } finally {
      setLoading(false);
    }
  }, [applicationId, currentOrg?.id, navigate, showToast]);

  useEffect(() => {
    loadApplication();
  }, [loadApplication]);

  const handleRunScreening = async () => {
    if (!application || !currentOrg?.id) return;
    try {
      setScreening(true);
      const result: ResumeScreeningResult = await applicationsApi.screen(
        currentOrg.id,
        application.id,
      );
      setApplication((current) =>
        current
          ? {
              ...current,
              status: 'SCREENING',
              stage: 'AI Resume Screening',
              matchScore: result.report.matchScore,
              analysis: {
                status: 'COMPLETED',
                analysisId: result.analysisId,
                analyzedAt: result.analyzedAt,
                report: result.report,
              },
            }
          : current,
      );
      showToast({
        title: result.report.matchScore === null ? 'Screening completed with limited evidence' : 'AI screening completed',
        description:
          result.report.matchScore === null
            ? 'The resume did not provide enough verifiable evidence for a reliable score.'
            : `Resume-to-job match score: ${Math.round(result.report.matchScore)}%`,
        variant: result.report.matchScore === null ? 'default' : 'success',
      });
    } catch (error: any) {
      showToast({
        title: 'AI screening failed',
        description: error.message,
        variant: 'destructive',
      });
      await loadApplication();
    } finally {
      setScreening(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center p-16"><Spinner size="lg" /></div>
      </AppLayout>
    );
  }

  if (!application) return null;

  const reportState = application.analysis;
  const canScreen =
    application.status === 'APPLIED' || reportState?.status === 'FAILED';

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/candidates/${application.candidateId}`)}
          >
            Back to Candidate
          </Button>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {application.candidate?.firstName} {application.candidate?.lastName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {application.job?.title || 'Applied position'}
                {application.job?.department ? ` · ${application.job.department}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="indigo" size="sm">{application.status}</Badge>
              {canScreen && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={screening}
                  onClick={handleRunScreening}
                >
                  {screening ? 'Screening...' : 'Run AI Screening'}
                </Button>
              )}
            </div>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Application overview</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Candidate</div>
              <div className="mt-1 text-foreground">{application.candidate?.email || 'Email unavailable'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applied role</div>
              <div className="mt-1 text-foreground">{application.job?.title || 'Job unavailable'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline stage</div>
              <div className="mt-1 text-foreground">{application.stage}</div>
            </div>
          </CardContent>
        </Card>

        {reportState?.status === 'COMPLETED' && reportState.report ? (
          <ResumeMatchReport
            report={reportState.report}
            analyzedAt={reportState.analyzedAt}
          />
        ) : reportState?.status === 'PROCESSING' || screening ? (
          <Card>
            <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
              <Spinner size="sm" />
              Resume screening is in progress. This page can be refreshed to check the saved result.
            </CardContent>
          </Card>
        ) : reportState?.status === 'FAILED' ? (
          <Card>
            <CardContent className="space-y-2 p-6">
              <h2 className="font-semibold text-foreground">Screening did not complete</h2>
              <p className="text-sm text-muted-foreground">
                {reportState.message || 'The AI provider could not complete this analysis. You can retry screening.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No AI resume-to-job report is available for this application yet.
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};
