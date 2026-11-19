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
import { candidatesApi, type Candidate } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

export const CandidateListPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchCandidates = useCallback(async () => {
    if (!currentOrg?.id) return;
    try {
      setLoading(true);
      const data = await candidatesApi.list(currentOrg.id, {
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setCandidates(data);
    } catch (err: any) {
      showToast({
        title: 'Failed to load candidates',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, statusFilter, search, showToast]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Candidate Directory
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage candidate profiles, parsed resumes, and AI interview pipelines.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate('/candidates/new')}
          leftIcon={<Icon name="Add" size={16} />}
        >
          Add Candidate
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
              placeholder="Search by name, email, headline, or skill..."
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
              <option value="NEW">New</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchCandidates}
              leftIcon={<Icon name="Refresh" size={14} />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Candidates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Candidates ({candidates.length})</CardTitle>
          <CardDescription>
            Talent database registered in {currentOrg?.name}
          </CardDescription>
        </CardHeader>

        {loading ? (
          <div className="p-12 flex justify-center items-center">
            <Spinner size="lg" />
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Icon name="Candidates" size={24} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">No candidates registered</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {search || statusFilter
                  ? 'No candidates match your current search query.'
                  : 'Add your first candidate to upload their resume and run AI analysis.'}
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/candidates/new')}
              leftIcon={<Icon name="Add" size={14} />}
            >
              Add First Candidate
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Headline / Role</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Top Skills</TableHead>
                <TableHead>Resumes</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((cand) => (
                <TableRow
                  key={cand.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/candidates/${cand.id}`)}
                >
                  <TableCell className="font-medium text-foreground">
                    <div className="font-semibold">{cand.firstName} {cand.lastName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{cand.email}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cand.headline || '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cand.location || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {cand.skills && cand.skills.length > 0 ? (
                        cand.skills.slice(0, 3).map((skill, i) => (
                          <Badge key={i} variant="primary" size="sm">
                            {skill}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {cand.skills && cand.skills.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{cand.skills.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="indigo" size="sm">
                      {cand._count?.resumes ?? 0} files
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="mint" size="sm">
                      {cand._count?.applications ?? 0} jobs
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/candidates/${cand.id}`);
                      }}
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
    </AppLayout>
  );
};
