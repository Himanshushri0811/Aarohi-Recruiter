import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/design-system/components/Input';
import { Button } from '@/design-system/components/Button';
import { Icon } from '@/design-system/icons';
import { authApi, ApiError } from '@/lib/api';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email) {
      setErrorMessage('Please enter your email address');
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.forgotPassword(email);
      setIsSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to send reset link. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your email to receive recovery instructions"
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Return to Sign In
        </Link>
      }
    >
      {isSent ? (
        <div className="text-center py-4 space-y-4">
          <div className="h-16 w-16 mx-auto rounded-full bg-accent/15 border border-accent/40 text-accent flex items-center justify-center">
            <Icon name="Mail" size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">Instructions Sent</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If an account with{' '}
              <span className="font-medium text-foreground">{email}</span> exists, you
              will receive an email with instructions to reset your password.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
              <Icon name="Error" size={14} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <Input
            label="Work Email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Icon name="Mail" size={16} />}
            required
            autoComplete="email"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isSubmitting}
            loadingText="Sending reset link..."
          >
            Send Reset Instructions
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};
