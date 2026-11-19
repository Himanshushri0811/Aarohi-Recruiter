import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/design-system/components/Input';
import { Button } from '@/design-system/components/Button';
import { Icon } from '@/design-system/icons';
import { organizationApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const OrganizationSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { refreshOrganizations, logout } = useAuth();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-generate slug preview
  const previewSlug = (name: string) =>
    name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === previewSlug(name)) {
      setSlug(previewSlug(val));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter an organization name');
      return;
    }

    setIsSubmitting(true);
    try {
      await organizationApi.create({
        name: name.trim(),
        slug: slug.trim() || undefined,
      });

      // Refresh organizations in AuthContext
      await refreshOrganizations();
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create organization. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create Your Organization"
      subtitle="Establish your tenant workspace to begin recruiting with Aarohi"
      footer={
        <button
          type="button"
          onClick={() => logout()}
          className="text-xs text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5 mx-auto"
        >
          <Icon name="Logout" size={14} />
          <span>Sign out and continue later</span>
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <Icon name="Error" size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <Input
          label="Organization / Company Name"
          placeholder="e.g. Acme Recruitment or Tech Corp"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          leftIcon={<Icon name="Organization" size={16} />}
          required
          autoFocus
        />

        <div>
          <Input
            label="Workspace URL Slug"
            placeholder="acme-recruitment"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />
          <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1 font-mono">
            <span>Workspace: aarohi.app/org/</span>
            <span className="font-semibold text-primary">{slug || 'your-slug'}</span>
          </p>
        </div>

        <div className="p-3 bg-secondary/50 rounded-lg border border-border text-xs space-y-1">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Icon name="Authentication" size={14} className="text-primary" />
            <span>Administrator Privileges</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            As creator, you will automatically be assigned the{' '}
            <strong className="text-foreground">Organization Admin (Owner)</strong> role
            with complete tenant governance and team management rights.
          </p>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isSubmitting}
          loadingText="Creating Organization..."
        >
          Create Workspace & Enter
        </Button>
      </form>
    </AuthLayout>
  );
};
