import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Icon,
  Spinner,
} from '@/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/design-system';
import { jobsApi, type CreateJobInput, type JobStatus } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

export const JobCreatePage: React.FC = () => {
  const { id: jobId } = useParams<{ id: string }>();
  const isEditing = Boolean(jobId);
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditing);

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('Remote');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [experienceLevel, setExperienceLevel] = useState('MID');
  const [status, setStatus] = useState<JobStatus>('PUBLISHED');
  const [skillsText, setSkillsText] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [responsibilities, setResponsibilities] = useState('');

  useEffect(() => {
    if (!jobId || !currentOrg?.id) return;

    async function loadJob() {
      try {
        setInitialLoading(true);
        const job = await jobsApi.get(currentOrg!.id, jobId!);
        setTitle(job.title);
        setDepartment(job.department);
        setLocation(job.location || 'Remote');
        setEmploymentType(job.employmentType || 'FULL_TIME');
        setExperienceLevel(job.experienceLevel || 'MID');
        setStatus(job.status);
        setSkillsText((job.skills || []).join(', '));
        setDescription(job.description || '');
        setRequirements(job.requirements || '');
        setResponsibilities(job.responsibilities || '');
      } catch (err: any) {
        showToast({
          title: 'Failed to load job',
          description: err.message,
          variant: 'destructive',
        });
        navigate('/jobs');
      } finally {
        setInitialLoading(false);
      }
    }

    loadJob();
  }, [jobId, currentOrg, navigate, showToast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg?.id) return;

    if (!title.trim() || !department.trim() || !description.trim()) {
      showToast({
        title: 'Validation error',
        description: 'Title, Department, and Description are required fields.',
        variant: 'destructive',
      });
      return;
    }

    const skills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: CreateJobInput = {
      title: title.trim(),
      department: department.trim(),
      location: location.trim() || undefined,
      employmentType,
      experienceLevel,
      status,
      skills,
      description: description.trim(),
      requirements: requirements.trim() || undefined,
      responsibilities: responsibilities.trim() || undefined,
    };

    try {
      setLoading(true);
      if (isEditing && jobId) {
        await jobsApi.update(currentOrg.id, jobId, payload);
        showToast({
          title: 'Job Updated',
          description: 'The job posting has been successfully saved.',
          variant: 'success',
        });
        navigate(`/jobs/${jobId}`);
      } else {
        const created = await jobsApi.create(currentOrg.id, payload);
        showToast({
          title: 'Job Created',
          description: `Job "${created.title}" is ready for candidate applications.`,
          variant: 'success',
        });
        navigate(`/jobs/${created.id}`);
      }
    } catch (err: any) {
      showToast({
        title: isEditing ? 'Failed to update job' : 'Failed to create job',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <AppLayout>
        <div className="p-12 flex justify-center items-center">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back and Title Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/jobs')}
          >
            ← Back to Jobs
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {isEditing ? 'Edit Job Posting' : 'Create New Job Description'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure role details, technical skills, and requirements for Aarohi AI voice screening.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Job Details */}
          <Card>
            <CardHeader>
              <CardTitle>Role Information</CardTitle>
              <CardDescription>
                Primary identifiers and categorization for this role
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Job Title <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Senior Full-Stack Engineer"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Department <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Engineering / Product"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Location</label>
                  <Input
                    placeholder="e.g. Remote, Bengaluru, SF"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Employment Type</label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="FULL_TIME">Full-time</option>
                    <option value="PART_TIME">Part-time</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="INTERN">Internship</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Experience Level</label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="JUNIOR">Junior (0-2 yrs)</option>
                    <option value="MID">Mid-Level (2-5 yrs)</option>
                    <option value="SENIOR">Senior (5-8 yrs)</option>
                    <option value="LEAD">Lead / Staff (8+ yrs)</option>
                    <option value="EXECUTIVE">Executive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Required Skills (comma-separated)
                </label>
                <Input
                  placeholder="e.g. React, TypeScript, Node.js, PostgreSQL, Docker"
                  value={skillsText}
                  onChange={(e) => setSkillsText(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  The Aarohi AI engine evaluates candidate resumes and structures interview questions around these skills.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Posting Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as JobStatus)}
                  className="w-full sm:w-48 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="PUBLISHED">Published (Accepting candidates)</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Job Descriptions & AI Rubrics */}
          <Card>
            <CardHeader>
              <CardTitle>Role Description & Rubrics</CardTitle>
              <CardDescription>
                Detailed specifications used by Aarohi to generate conversational interview scenarios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Job Description <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={5}
                  placeholder="Describe the mission, team context, and key objectives of this role..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full p-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Requirements & Qualifications</label>
                <textarea
                  rows={4}
                  placeholder="List essential technical qualifications, degrees, or certifications..."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  className="w-full p-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Responsibilities</label>
                <textarea
                  rows={4}
                  placeholder="Outline key day-to-day deliverables and expectations..."
                  value={responsibilities}
                  onChange={(e) => setResponsibilities(e.target.value)}
                  className="w-full p-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/jobs')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              leftIcon={loading ? <Spinner size="sm" /> : <Icon name="Success" size={16} />}
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Job Posting'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};
