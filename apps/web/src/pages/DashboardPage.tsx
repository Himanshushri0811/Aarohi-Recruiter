import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  StatCard,
  Badge,
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
  Icon,
  Spinner,
} from '@/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { statsApi, jobsApi, candidatesApi, type OrgStats, type Job, type Candidate } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg } = useAuth();

  const [stats, setStats] = useState<OrgStats>({ jobs: 0, candidates: 0, applications: 0 });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [recentCandidates, setRecentCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      const [statsData, jobsData, candData] = await Promise.all([
        statsApi.get(currentOrg.id).catch(() => ({ jobs: 0, candidates: 0, applications: 0 })),
        jobsApi.list(currentOrg.id).catch(() => []),
        candidatesApi.list(currentOrg.id).catch(() => []),
      ]);
      setStats(statsData);
      setRecentJobs(jobsData.slice(0, 5));
      setRecentCandidates(candData.slice(0, 5));
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <AppLayout>
      {/* Welcome Banner */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-surface to-secondary/30 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {currentOrg?.name} Recruitment Command Center
            </h1>
            <Badge variant="mint" size="sm" icon={<Icon name="Success" size={12} />}>
              Active Tenant
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Aarohi AI Recruitment Suite is active. Manage job requisitions, parse resumes, and
            orchestrate structured conversational interviews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/candidates/new')}
            leftIcon={<Icon name="Add" size={14} />}
          >
            Add Candidate
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/jobs/new')}
            leftIcon={<Icon name="Add" size={14} />}
          >
            Post New Job
          </Button>
        </div>
      </div>

      {/* Live Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Candidates"
          value={loading ? '...' : String(stats.candidates)}
          subtitle="Indexed in talent pool"
          icon="Candidates"
        />
        <StatCard
          title="Open Job Requisitions"
          value={loading ? '...' : String(stats.jobs)}
          subtitle="Active openings"
          icon="Jobs"
        />
        <StatCard
          title="Pipeline Applications"
          value={loading ? '...' : String(stats.applications)}
          subtitle="Aarohi AI interviews & screening"
          icon="Interviews"
          variant="ai"
        />
      </div>

      {/* Recent Openings & Recent Candidates side-by-side or stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Job Openings</CardTitle>
              <CardDescription>Roles accepting applicant submissions</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/jobs')}
            >
              View All ({stats.jobs})
            </Button>
          </CardHeader>

          {loading ? (
            <div className="p-8 flex justify-center"><Spinner size="md" /></div>
          ) : recentJobs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
              <p>No job postings created yet.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/jobs/new')}
              >
                Create First Opening
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role Title</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentJobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium text-foreground">
                      {j.title}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {j.department}
                    </TableCell>
                    <TableCell>
                      <Badge variant="mint" size="sm">{j.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/jobs/${j.id}`)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Recent Candidates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Candidates</CardTitle>
              <CardDescription>Latest profiles added to talent database</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/candidates')}
            >
              View All ({stats.candidates})
            </Button>
          </CardHeader>

          {loading ? (
            <div className="p-8 flex justify-center"><Spinner size="md" /></div>
          ) : recentCandidates.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
              <p>No candidates registered yet.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/candidates/new')}
              >
                Add Candidate Profile
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Headline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCandidates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">
                      <div>{c.firstName} {c.lastName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{c.email}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {c.headline || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="indigo" size="sm">{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/candidates/${c.id}`)}
                      >
                        Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Security and Tenant Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization & Security Configuration</CardTitle>
          <CardDescription>
            Tenant identity, role boundaries, and audit trail verification
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium text-foreground">Tenant Organization</TableCell>
              <TableCell className="text-muted-foreground">{currentOrg?.name}</TableCell>
              <TableCell>
                <Badge variant="mint" size="sm">ACTIVE</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-foreground">Tenant Identifier</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{currentOrg?.id}</TableCell>
              <TableCell>
                <Badge variant="primary" size="sm">Isolated</Badge>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium text-foreground">Your Role</TableCell>
              <TableCell className="text-muted-foreground">{currentOrg?.role || 'OWNER'}</TableCell>
              <TableCell>
                <Badge variant="indigo" size="sm">Full Administrative Access</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>
    </AppLayout>
  );
};
