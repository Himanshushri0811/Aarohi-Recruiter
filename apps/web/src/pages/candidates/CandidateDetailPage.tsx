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
import {
  candidatesApi,
  jobsApi,
  applicationsApi,
  type Candidate,
  type Resume,
  type Job,
  type Application,
  type ApplicationStatus,
} from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';
import { ResumeMatchReport } from '@/components/applications/ResumeMatchReport';

export const CandidateDetailPage: React.FC = () => {
  const { id: candidateId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [associating, setAssociating] = useState(false);
  const [expandedResumeId, setExpandedResumeId] = useState<string | null>(null);
  const [screeningAppId, setScreeningAppId] = useState<string | null>(null);

  const loadAllData = useCallback(async () => {
    if (!candidateId || !currentOrg?.id) return;
    try {
      setLoading(true);
      const [candData, resumeList, appList, jobList] = await Promise.all([
        candidatesApi.get(currentOrg.id, candidateId),
        candidatesApi.listResumes(currentOrg.id, candidateId),
        applicationsApi.list(currentOrg.id, { candidateId }),
        jobsApi.list(currentOrg.id, { status: 'PUBLISHED' }),
      ]);
      setCandidate(candData);
      setResumes(resumeList);
      setApplications(appList);
      setJobs(jobList);
      if (jobList.length > 0 && !selectedJobId) {
        setSelectedJobId(jobList[0].id);
      }
    } catch (err: any) {
      showToast({
        title: 'Failed to load profile',
        description: err.message,
        variant: 'destructive',
      });
      navigate('/candidates');
    } finally {
      setLoading(false);
    }
  }, [candidateId, currentOrg?.id, navigate, showToast, selectedJobId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !currentOrg?.id || !candidateId) return;
    const file = e.target.files[0];

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!validTypes.includes(file.type)) {
      showToast({
        title: 'Invalid file format',
        description: 'Please upload a PDF (.pdf) or Word document (.docx)',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);
      showToast({
        title: 'Uploading & Extracting',
        description: 'Running Aarohi text extraction engine...',
        variant: 'default',
      });
      const uploaded = await candidatesApi.uploadResume(currentOrg.id, candidateId, file);
      showToast({
        title: 'Resume Processed',
        description: `Successfully extracted text and parsed metadata for "${uploaded.fileName}"`,
        variant: 'success',
      });
      loadAllData();
    } catch (err: any) {
      showToast({
        title: 'Upload failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAssociateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !currentOrg?.id || !candidateId) return;

    try {
      setAssociating(true);
      await applicationsApi.create(currentOrg.id, {
        jobId: selectedJobId,
        candidateId,
        resumeId: resumes[0]?.id,
      });
      showToast({
        title: 'Candidate Applied',
        description: 'Candidate associated with role. Ready for AI screening pipeline.',
        variant: 'success',
      });
      loadAllData();
    } catch (err: any) {
      showToast({
        title: 'Association failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setAssociating(false);
    }
  };

  const handleUpdateAppStatus = async (
    appId: string,
    newStatus: ApplicationStatus,
    stage: string,
  ) => {
    if (!currentOrg?.id) return;
    try {
      await applicationsApi.updateStatus(currentOrg.id, appId, newStatus, stage);
      showToast({
        title: 'Pipeline Updated',
        description: `Candidate progressed to: ${stage}`,
        variant: 'success',
      });
      loadAllData();
    } catch (err: any) {
      showToast({
        title: 'Status update failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleRunScreening = async (appId: string) => {
    if (!currentOrg?.id) return;
    try {
      setScreeningAppId(appId);
      const result = await applicationsApi.screen(currentOrg.id, appId);
      showToast({
        title: result.report.matchScore === null ? 'Screening completed with limited evidence' : 'AI screening completed',
        description:
          result.report.matchScore === null
            ? 'The resume did not provide enough verifiable evidence for a reliable score.'
            : `Resume-to-job match score: ${Math.round(result.report.matchScore)}%`,
        variant: result.report.matchScore === null ? 'default' : 'success',
      });
      await loadAllData();
    } catch (err: any) {
      showToast({
        title: 'AI screening failed',
        description: err.message,
        variant: 'destructive',
      });
      await loadAllData();
    } finally {
      setScreeningAppId(null);
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

  if (!candidate) return null;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/candidates')}
              className="mb-2"
            >
              ← Back to Candidates
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {candidate.firstName} {candidate.lastName}
              </h1>
              <Badge variant="mint" size="sm">{candidate.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {candidate.headline || 'Candidate Profile'} • {candidate.location || 'Location Not Specified'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              id="upload-resume-btn"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="primary"
              size="sm"
              disabled={uploading}
              onClick={() => document.getElementById('upload-resume-btn')?.click()}
              leftIcon={uploading ? <Spinner size="sm" /> : <Icon name="Add" size={14} />}
            >
              {uploading ? 'Processing Resume...' : 'Upload Resume'}
            </Button>
          </div>
        </div>

        {/* Candidate Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground font-medium">Contact Information</div>
            <div className="text-sm font-semibold text-foreground mt-1 truncate">
              {candidate.email}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {candidate.phone || 'No phone recorded'}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-muted-foreground font-medium">Experience Level</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {candidate.experienceYears ? `${candidate.experienceYears} Years` : 'Unspecified'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Verified through parsed resume history
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs text-muted-foreground font-medium">Pipeline Status</div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {applications.length} Active {applications.length === 1 ? 'Role' : 'Roles'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Associated job requisitions
            </div>
          </Card>
        </div>

        {/* Skills & Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Professional Profile & Skills</CardTitle>
            <CardDescription>
              Technical competencies indexed for Aarohi AI evaluation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {candidate.skills && candidate.skills.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Verified Skills
                </div>
                <div className="flex flex-wrap gap-2">
                  {candidate.skills.map((skill, i) => (
                    <Badge key={i} variant="primary" size="sm">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {candidate.summary && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Summary
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                  {candidate.summary}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumes and Parsed Text Analysis Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Uploaded Resumes & AI Parsing ({resumes.length})</CardTitle>
              <CardDescription>
                Extracted resume documents with structured entities
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => document.getElementById('upload-resume-btn')?.click()}
              leftIcon={<Icon name="Add" size={14} />}
            >
              Add Document
            </Button>
          </CardHeader>

          {resumes.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="text-sm text-muted-foreground">
                No resumes uploaded yet for this candidate.
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => document.getElementById('upload-resume-btn')?.click()}
                leftIcon={<Icon name="Add" size={14} />}
              >
                Upload First Resume (PDF/DOCX)
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {resumes.map((resume) => {
                const isExpanded = expandedResumeId === resume.id;
                return (
                  <div key={resume.id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                          <Icon name="Candidates" size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {resume.fileName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(resume.fileSize / 1024).toFixed(1)} KB • Uploaded {new Date(resume.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {resume.parsingStatus === 'PARSED' ? (
                          <Badge variant="mint" size="sm" icon={<Icon name="Success" size={12} />}>
                            Parsed
                          </Badge>
                        ) : resume.parsingStatus === 'PENDING' ? (
                          <Badge variant="indigo" size="sm">
                            Pending
                          </Badge>
                        ) : (
                          <Badge variant="danger" size="sm">
                            Failed
                          </Badge>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedResumeId(isExpanded ? null : resume.id)}
                        >
                          {isExpanded ? 'Hide Extracted Text' : 'View Extracted Text'}
                        </Button>
                      </div>
                    </div>

                    {/* Parsed structured summary */}
                    {resume.parsedData && (
                      <div className="bg-muted/40 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="font-semibold text-foreground">Identified Email:</span>{' '}
                          <span className="text-muted-foreground font-mono">
                            {resume.parsedData.email || 'None'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">Phone:</span>{' '}
                          <span className="text-muted-foreground font-mono">
                            {resume.parsedData.phone || 'None'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-foreground">Extracted Skills:</span>{' '}
                          <span className="text-primary font-medium">
                            {resume.parsedData.skills?.length || 0} skills detected
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Expanded Raw Extracted Text */}
                    {isExpanded && (
                      <div className="mt-3 p-4 bg-background border border-border rounded-lg text-xs font-mono text-muted-foreground whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed shadow-inner">
                        {resume.extractedText || 'No text extracted.'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Job Applications & Recruitment Pipeline Section */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Job Applications & Pipeline Stage ({applications.length})</CardTitle>
              <CardDescription>
                Associate this candidate with open roles and advance through interview stages
              </CardDescription>
            </div>

            {/* Associate with Job Form */}
            {jobs.length > 0 && (
              <form onSubmit={handleAssociateJob} className="flex items-center gap-2">
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.department})
                    </option>
                  ))}
                </select>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={associating}
                  leftIcon={<Icon name="Add" size={14} />}
                >
                  {associating ? 'Associating...' : 'Apply to Role'}
                </Button>
              </form>
            )}
          </CardHeader>

          {applications.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="text-sm text-muted-foreground">
                This candidate is not currently associated with any open jobs.
              </div>
              {jobs.length === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/jobs/new')}
                >
                  Create a Job Opening First
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target Job Opening</TableHead>
                  <TableHead>Current Pipeline Stage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>AI Match</TableHead>
                  <TableHead>Applied Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-semibold text-foreground">
                      <div
                        className="hover:underline cursor-pointer"
                        onClick={() => navigate(`/jobs/${app.jobId}`)}
                      >
                        {app.job?.title || 'Job Opening'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {app.job?.department}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="indigo" size="sm">{app.stage}</Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant="mint" size="sm">{app.status}</Badge>
                    </TableCell>

                    <TableCell>
                      {app.analysis?.status === 'COMPLETED' && app.analysis.report ? (
                        <ResumeMatchReport
                          compact
                          report={app.analysis.report}
                          analyzedAt={app.analysis.analyzedAt}
                        />
                      ) : app.analysis?.status === 'PROCESSING' ? (
                        <span className="text-xs text-muted-foreground">Screening in progress</span>
                      ) : app.analysis?.status === 'FAILED' ? (
                        <span className="text-xs text-destructive">Screening failed · retry available</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not screened</span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(app.createdAt).toLocaleDateString()}
                    </TableCell>

                    <TableCell className="text-right space-x-1">
                      {(app.status === 'APPLIED' || app.analysis?.status === 'FAILED') && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={screeningAppId === app.id}
                          onClick={() => handleRunScreening(app.id)}
                        >
                          {screeningAppId === app.id ? 'Screening...' : 'Run AI Screening'}
                        </Button>
                      )}

                      {app.status === 'SCREENING' && app.analysis?.status === 'COMPLETED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            handleUpdateAppStatus(
                              app.id,
                              'INTERVIEW_SCHEDULED',
                              'Aarohi Voice Interview',
                            )
                          }
                        >
                          Schedule AI Interview
                        </Button>
                      )}

                      {app.status === 'INTERVIEW_SCHEDULED' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() =>
                            handleUpdateAppStatus(
                              app.id,
                              'INTERVIEW_COMPLETED',
                              'Evaluation & Scoring',
                            )
                          }
                        >
                          Complete AI Interview
                        </Button>
                      )}

                      {app.status === 'INTERVIEW_COMPLETED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleUpdateAppStatus(
                              app.id,
                              'OFFERED',
                              'Offer Extended',
                            )
                          }
                        >
                          Extend Offer
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/applications/${app.id}`)}
                      >
                        View Report
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
