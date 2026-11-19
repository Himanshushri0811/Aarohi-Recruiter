import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Icon,
  Spinner,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/design-system';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/design-system';
import { interviewsApi, type Interview, type InterviewStatus } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

const STATUS_COLORS: Record<InterviewStatus, 'primary' | 'secondary' | 'mint' | 'warning' | 'danger' | 'outline'> = {
  DRAFT: 'outline',
  SCHEDULED: 'secondary',
  INVITED: 'primary',
  READY: 'warning',
  IN_PROGRESS: 'warning',
  PAUSED: 'outline',
  COMPLETED: 'mint',
  CANCELLED: 'danger',
  EXPIRED: 'outline',
  FAILED: 'danger',
};

export const InterviewListPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    try {
      setLoading(true);
      const result = await interviewsApi.list(currentOrg.id);
      const list = Array.isArray(result)
        ? result
        : Array.isArray((result as any)?.data)
        ? (result as any).data
        : [];
      setInterviews(list);
    } catch {
      showToast({ title: 'Failed to load interviews', variant: 'error' });
      setInterviews([]);
    } finally {
      setLoading(false);
    }
  }, [currentOrg, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const interviewList = Array.isArray(interviews) ? interviews : [];

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Interviews</h1>
            <p className="text-gray-500 mt-1">Manage AI-powered candidate interviews</p>
          </div>
          <Button onClick={() => navigate('/interviews/new')}>
            <Icon name="Add" className="mr-2" />
            New Interview
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Interviews</CardTitle>
            <CardDescription>{interviewList.length} total</CardDescription>
          </CardHeader>
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : interviewList.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Icon name="Interviews" className="mx-auto mb-3 h-10 w-10 text-gray-400" />
              <p className="text-lg font-medium text-gray-700">No interviews yet</p>
              <p className="text-sm mt-1">Create your first AI interview to get started</p>
              <Button className="mt-4" onClick={() => navigate('/interviews/new')}>
                Create Interview
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {interviewList.map((iv) => (
                  <TableRow
                    key={iv.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/interviews/${iv.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">
                        {iv.candidate ? `${iv.candidate.firstName || ''} ${iv.candidate.lastName || ''}`.trim() || '—' : '—'}
                      </div>
                      <div className="text-xs text-gray-400">{iv.candidate?.email || ''}</div>
                    </TableCell>
                    <TableCell>
                      <div>{iv.job?.title ?? '—'}</div>
                      <div className="text-xs text-gray-400">{iv.job?.department}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">{iv.type ? iv.type.toLowerCase() : 'mixed'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[iv.status] || 'outline'}>{iv.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/interviews/${iv.id}`)}>
                        View
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

export default InterviewListPage;
