import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/design-system/components/Input';
import { Button } from '@/design-system/components/Button';
import { Icon } from '@/design-system/icons';
import { authApi, ApiError } from '@/lib/api';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Requirements
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Missing password reset token. Please check your reset email link.');
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage('Password must be at least 8 characters with uppercase, lowercase, and a number.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to reset password. The link may be expired.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="Invalid Link"
        subtitle="Password recovery link is invalid or malformed"
        footer={
          <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
            Request a new link
          </Link>
        }
      >
        <div className="text-center py-4 space-y-3">
          <div className="h-14 w-14 mx-auto rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <Icon name="Error" size={28} />
          </div>
          <p className="text-xs text-muted-foreground">
            No reset token was found in the URL. Please click the link directly from your email.
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (isSuccess) {
    return (
      <AuthLayout
        title="Password Reset Complete"
        subtitle="You can now sign in with your new password"
      >
        <div className="text-center py-4 space-y-4">
          <div className="h-16 w-16 mx-auto rounded-full bg-accent/15 border border-accent/40 text-accent flex items-center justify-center">
            <Icon name="Success" size={32} />
          </div>
          <p className="text-xs text-muted-foreground">
            All active sessions have been revoked. Please sign in with your updated credentials.
          </p>
          <Button
            variant="primary"
            className="w-full"
            onClick={() => navigate('/login')}
          >
            Sign In Now
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create New Password"
      subtitle="Enter and confirm your new secure password"
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Return to Sign In
        </Link>
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
          label="New Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Icon name="Lock" size={16} />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="hover:text-foreground focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={16} />
            </button>
          }
          required
        />

        <Input
          label="Confirm New Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          leftIcon={<Icon name="Lock" size={16} />}
          required
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          isLoading={isSubmitting}
          loadingText="Updating password..."
        >
          Reset Password
        </Button>
      </form>
    </AuthLayout>
  );
};
