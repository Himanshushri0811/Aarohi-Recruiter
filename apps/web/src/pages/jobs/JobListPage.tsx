import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { jobsApi, type Job, type JobStatus } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

export const JobListPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchJobs = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      const data = await jobsApi.list(currentOrg.id, {
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setJobs(data);
    } catch (err: any) {
      showToast({
        title: 'Failed to load jobs',
        description: err.message || 'Could not fetch job postings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, statusFilter, search, showToast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    if (!currentOrg?.id) return;
    try {
      await jobsApi.updateStatus(currentOrg.id, jobId, newStatus);
      showToast({
        title: 'Status Updated',
        description: `Job marked as ${newStatus}`,
        variant: 'success',
      });
      fetchJobs();
    } catch (err: any) {
      showToast({
        title: 'Update failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: JobStatus) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="mint" size="sm">Active</Badge>;
      case 'DRAFT':
        return <Badge variant="indigo" size="sm">Draft</Badge>;
      case 'ARCHIVED':
        return <Badge variant="outline" size="sm">Archived</Badge>;
      case 'CLOSED':
        return <Badge variant="outline" size="sm">Closed</Badge>;
      default:
        return <Badge variant="outline" size="sm">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Job Openings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your open roles, requirements, and candidate pipelines.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate('/jobs/new')}
          leftIcon={<Icon name="Add" size={16} />}
        >
          Post New Job
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              <Icon name="Search" size={16} />
            </div>
            <input
              type="text"
              placeholder="Search by job title, department, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
              <option value="CLOSED">Closed</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchJobs}
              leftIcon={<Icon name="Refresh" size={14} />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Openings ({jobs.length})</CardTitle>
          <CardDescription>
            Roles configured with Aarohi AI voice interview workflows
          </CardDescription>
        </CardHeader>

        {loading ? (
          <div className="p-12 flex justify-center items-center">
            <Spinner size="lg" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Icon name="Jobs" size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">No jobs found</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {search || statusFilter
                  ? 'No job postings match your current filter criteria.'
                  : 'Get started by creating your first job description for AI candidate screening.'}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/jobs/new')}
              leftIcon={<Icon name="Add" size={14} />}
            >
              Post First Job
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applicants</TableHead>
                <TableHead>Date Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell
                    className="font-medium text-foreground hover:underline"
                    onClick={() => navigate(`/jobs/${job.id}`)}
                  >
                    <div>{job.title}</div>
                    <div className="text-xs text-muted-foreground">{job.employmentType || 'FULL_TIME'}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{job.department}</TableCell>
                  <TableCell className="text-muted-foreground">{job.location || 'Remote'}</TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-foreground">
                      {job._count?.applications ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/jobs/${job.id}/edit`)}
                    >
                      Edit
                    </Button>
                    {job.status === 'PUBLISHED' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(job.id, 'ARCHIVED')}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Archive
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStatusChange(job.id, 'PUBLISHED')}
                        className="text-muted-foreground hover:text-primary"
                      >
                        Publish
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
};
