import React from 'react';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import type { ResumeEvidenceFinding, ResumeMatchReport as ResumeMatchReportData } from '@/lib/api';

interface ResumeMatchReportProps {
  report: ResumeMatchReportData;
  analyzedAt?: string;
  compact?: boolean;
}

function FindingList({
  title,
  findings,
}: {
  title: string;
  findings: ResumeEvidenceFinding[];
}) {
  if (findings.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-3">
        {findings.map((finding, index) => (
          <div key={`${finding.title}-${index}`} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{finding.title}</span>
              <Badge variant={finding.status === 'demonstrated' ? 'mint' : 'outline'} size="sm">
                {finding.status.replaceAll('_', ' ')}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {finding.confidence} confidence
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{finding.summary}</p>
            {(finding.resumeEvidence.length > 0 || finding.jobEvidence.length > 0) && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {finding.resumeEvidence.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Resume evidence
                    </div>
                    {finding.resumeEvidence.map((quote, quoteIndex) => (
                      <blockquote
                        key={quoteIndex}
                        className="mt-1 border-l-2 border-primary/40 pl-3 text-xs text-foreground/80"
                      >
                        “{quote}”
                      </blockquote>
                    ))}
                  </div>
                )}
                {finding.jobEvidence.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Job criteria
                    </div>
                    {finding.jobEvidence.map((quote, quoteIndex) => (
                      <blockquote
                        key={quoteIndex}
                        className="mt-1 border-l-2 border-border pl-3 text-xs text-muted-foreground"
                      >
                        “{quote}”
                      </blockquote>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export const ResumeMatchReport: React.FC<ResumeMatchReportProps> = ({
  report,
  analyzedAt,
  compact = false,
}) => {
  const score =
    report.matchScore === null ? 'Insufficient evidence' : `${Math.round(report.matchScore)}%`;

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{score}</span>
          <Badge variant="outline" size="sm">{report.analysisConfidence} confidence</Badge>
        </div>
        <p className="max-w-xl text-xs text-muted-foreground line-clamp-2">
          {report.fitSummary}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>AI Resume-to-Job Analysis</CardTitle>
              {analyzedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Analyzed {new Date(analyzedAt).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={report.matchScore === null ? 'outline' : 'mint'} size="lg">
                {score}
              </Badge>
              <Badge variant="outline" size="sm">{report.analysisConfidence} confidence</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.insufficientInformation && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
              The available resume evidence is insufficient for a reliable overall score.
            </div>
          )}
          <p className="text-sm leading-relaxed text-foreground/90">{report.fitSummary}</p>
          <p className="text-xs text-muted-foreground">
            Advisory analysis only. Review the cited resume evidence and make hiring decisions through your normal human review process.
          </p>
        </CardContent>
      </Card>

      <FindingList title="Required skills" findings={report.requiredSkills} />
      <FindingList title="Preferred skills" findings={report.preferredSkills} />
      <FindingList title="Relevant experience" findings={[report.experienceAssessment]} />
      <FindingList title="Project relevance" findings={report.projectAssessments} />
      <FindingList title="Education requirements" findings={[report.educationAssessment]} />
      <FindingList title="Strengths" findings={report.strengths} />
      <FindingList title="Areas to investigate" findings={report.gaps} />
      <FindingList title="Missing or unverified qualifications" findings={report.missingQualifications} />

      {report.suggestedInterviewTopics.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Suggested follow-up topics</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {report.suggestedInterviewTopics.map((topic, index) => <li key={index}>{topic}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
