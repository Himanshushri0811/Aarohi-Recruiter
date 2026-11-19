import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { candidatesApi, type CreateCandidateInput } from '@/lib/api';
import { AppLayout } from '@/components/layout/AppLayout';

export const CandidateCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrg } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [headline, setHeadline] = useState('');
  const [experienceYears, setExperienceYears] = useState<string>('');
  const [skillsText, setSkillsText] = useState('');
  const [summary, setSummary] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
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
      if (file.size > 10 * 1024 * 1024) {
        showToast({
          title: 'File too large',
          description: 'Max file size is 10 MB',
          variant: 'destructive',
        });
        return;
      }
      setResumeFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg?.id) return;

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      showToast({
        title: 'Validation error',
        description: 'First Name, Last Name, and Email are required fields.',
        variant: 'destructive',
      });
      return;
    }

    const skills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: CreateCandidateInput = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      location: location.trim() || undefined,
      headline: headline.trim() || undefined,
      experienceYears: experienceYears ? parseFloat(experienceYears) : undefined,
      skills,
      summary: summary.trim() || undefined,
    };

    try {
      setLoading(true);
      const candidate = await candidatesApi.create(currentOrg.id, payload);

      if (resumeFile) {
        showToast({
          title: 'Candidate Created',
          description: 'Uploading and parsing resume with Aarohi AI...',
          variant: 'default',
        });
        await candidatesApi.uploadResume(currentOrg.id, candidate.id, resumeFile);
      }

      showToast({
        title: 'Candidate Profile Ready',
        description: `Profile for ${candidate.firstName} ${candidate.lastName} created successfully.`,
        variant: 'success',
      });
      navigate(`/candidates/${candidate.id}`);
    } catch (err: any) {
      showToast({
        title: 'Creation failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/candidates')}
          >
            ← Back to Candidates
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Add New Candidate
            </h1>
            <p className="text-sm text-muted-foreground">
              Register candidate credentials and upload resume for automated parsing
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identity & Contact */}
          <Card>
            <CardHeader>
              <CardTitle>Personal & Contact Information</CardTitle>
              <CardDescription>
                Basic details for candidate record and pipeline identification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    First Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Maya"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Last Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Patel"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Email Address <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="e.g. maya.patel@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Phone Number</label>
                  <Input
                    placeholder="e.g. +1 (555) 234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Location</label>
                  <Input
                    placeholder="e.g. San Francisco, CA / Remote"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Professional Headline</label>
                  <Input
                    placeholder="e.g. Senior Cloud Architect & DevOps"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Years of Experience</label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="e.g. 5"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Skills (comma-separated)</label>
                  <Input
                    placeholder="e.g. Python, AWS, Docker, FastAPI"
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Professional Summary</label>
                <textarea
                  rows={3}
                  placeholder="Brief background or recruiter notes..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full p-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </CardContent>
          </Card>

          {/* Resume Upload Attachment */}
          <Card>
            <CardHeader>
              <CardTitle>Resume Attachment (PDF or DOCX)</CardTitle>
              <CardDescription>
                Attach resume for automatic text extraction, skill parsing, and AI match scoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  id="resume-file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="resume-file"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Icon name="Candidates" size={24} />
                  </div>
                  {resumeFile ? (
                    <div>
                      <div className="font-semibold text-sm text-foreground">
                        {resumeFile.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(resumeFile.size / 1024).toFixed(1)} KB — Ready to upload
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        Click to select resume document
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Supports PDF and DOCX up to 10 MB
                      </div>
                    </div>
                  )}
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/candidates')}
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
              {loading ? 'Creating...' : 'Register Candidate Profile'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};
