import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Icon,
  Spinner,
} from '@/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/design-system';
import { jobsApi, applicationsApi, type Job, type Application } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

export const JobDetailPage: React.FC = () => {
  const { id: jobId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();

  const [job, setJob] = useState<Job | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!jobId || !currentOrg?.id) return;

    try {
      setLoading(true);
      const [jobData, appsData] = await Promise.all([
        jobsApi.get(currentOrg.id, jobId),
        applicationsApi.list(currentOrg.id, { jobId }),
      ]);
      setJob(jobData);
      setApplications(appsData);
    } catch (err: any) {
      showToast({
        title: 'Error loading job details',
        description: err.message,
        variant: 'destructive',
      });
      navigate('/jobs');
    } finally {
      setLoading(false);
    }
  }, [jobId, currentOrg?.id, navigate, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleStatus = async () => {
    if (!job || !currentOrg?.id) return;
    const targetStatus = job.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    try {
      await jobsApi.updateStatus(currentOrg.id, job.id, targetStatus);
      showToast({
        title: 'Status Updated',
        description: `Job is now ${targetStatus}`,
        variant: 'success',
      });
      loadData();
    } catch (err: any) {
      showToast({
        title: 'Failed to update status',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-16 flex justify-center items-center">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (!job) return null;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/jobs')}
              className="mb-2"
            >
              ← Back to Jobs
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {job.title}
              </h1>
              {job.status === 'PUBLISHED' ? (
                <Badge variant="mint" size="sm">Active</Badge>
              ) : job.status === 'DRAFT' ? (
                <Badge variant="indigo" size="sm">Draft</Badge>
              ) : (
                <Badge variant="outline" size="sm">{job.status}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {job.department} • {job.location || 'Remote'} • {job.employmentType || 'FULL_TIME'} • Created {new Date(job.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/jobs/${job.id}/edit`)}
            >
              Edit Role
            </Button>
            <Button
              variant={job.status === 'PUBLISHED' ? 'outline' : 'primary'}
              size="sm"
              onClick={handleToggleStatus}
            >
              {job.status === 'PUBLISHED' ? 'Archive Role' : 'Publish Role'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/candidates/new')}
              leftIcon={<Icon name="Add" size={14} />}
            >
              Add Candidate
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground font-medium">Pipeline Candidates</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {applications.length}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Associated with this job requisition
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-muted-foreground font-medium">Target Experience</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {job.experienceLevel || 'MID'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Seniority profile evaluation
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-muted-foreground font-medium">AI Screening Model</div>
            <div className="text-2xl font-bold text-foreground mt-1 flex items-center gap-2">
              <span>Aarohi v1</span>
              <Badge variant="mint" size="sm">Voice Active</Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Automated rubric scoring enabled
            </div>
          </Card>
        </div>

        {/* Role Specification & Skills */}
        <Card>
          <CardHeader>
            <CardTitle>Role Description & Skills Profile</CardTitle>
            <CardDescription>
              Technical criteria evaluated during Aarohi AI candidate interviews
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {job.skills && job.skills.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Target Technical Competencies
                </div>
                <div className="flex flex-wrap gap-2">
                  {job.skills.map((skill, idx) => (
                    <Badge key={idx} variant="primary" size="sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Mission & Context
              </div>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                {job.description}
              </p>
            </div>

            {job.requirements && (
              <div className="space-y-2 border-t border-border pt-4">
                <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Requirements & Qualifications
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                  {job.requirements}
                </p>
              </div>
            )}

            {job.responsibilities && (
              <div className="space-y-2 border-t border-border pt-4">
                <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Key Responsibilities
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                  {job.responsibilities}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Associated Candidates / Pipeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Applicant Pipeline ({applications.length})</CardTitle>
              <CardDescription>
                Candidates evaluated or queued for Aarohi AI interviews
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/candidates')}
              leftIcon={<Icon name="Search" size={14} />}
            >
              Browse All Candidates
            </Button>
          </CardHeader>

          {applications.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="text-sm text-muted-foreground">
                No candidates have applied or been associated with this opening yet.
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/candidates/new')}
                leftIcon={<Icon name="Add" size={14} />}
              >
                Add Candidate Profile
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Match Score</TableHead>
                  <TableHead>Applied Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium text-foreground">
                      {app.candidate?.firstName} {app.candidate?.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {app.candidate?.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="indigo" size="sm">{app.stage}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="mint" size="sm">{app.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {app.matchScore !== null && app.matchScore !== undefined ? (
                        <span className="font-bold text-primary">
                          {Math.round(app.matchScore)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Pending AI eval</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/candidates/${app.candidateId}`)}
                      >
                        View Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};
