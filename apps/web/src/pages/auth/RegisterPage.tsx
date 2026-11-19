import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/design-system/components/Input';
import { Button } from '@/design-system/components/Button';
import { Badge } from '@/design-system/components/Badge';
import { Icon } from '@/design-system/icons';
import { useAuth } from '@/contexts/AuthContext';
import { authApi, ApiError } from '@/lib/api';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Verification state after successful registration
  const [isSuccess, setIsSuccess] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Password requirements checklist
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isPasswordValid) {
      setErrorMessage('Please ensure your password meets all requirements.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await register({
        firstName,
        lastName,
        email,
        password,
      });

      setIsSuccess(true);
      if (res.devVerificationToken) {
        setDevToken(res.devVerificationToken);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to create account. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setResendMessage(null);
    try {
      const res = await authApi.resendVerification(email);
      setResendMessage(res.message);
      if (res.devVerificationToken) {
        setDevToken(res.devVerificationToken);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setResendMessage(err.message);
      } else {
        setResendMessage('Failed to resend verification link. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  if (isSuccess) {
    return (
      <AuthLayout
        title="Verify Your Email"
        subtitle="Verification required before accessing your workspace"
        footer={
          <p className="text-muted-foreground">
            Already verified?{' '}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              Sign in to your account
            </Link>
          </p>
        }
      >
        <div className="text-center py-3 space-y-4">
          <div className="h-16 w-16 mx-auto rounded-full bg-accent/15 border border-accent/40 text-accent flex items-center justify-center">
            <Icon name="Mail" size={32} />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Verification sent to:
            </p>
            <p className="text-xs font-mono font-bold text-primary">{email}</p>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Please verify your email address to activate your account. You will not be
            able to sign in until verification is completed.
          </p>

          {/* Development verification helper */}
          {devToken && (
            <div className="p-3.5 rounded-lg border border-primary/30 bg-secondary/60 text-left space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Icon name="AIAssistant" size={14} className="text-primary" />
                  Local Development Mode
                </span>
                <Badge variant="indigo" size="sm">Dev Helper</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                SMTP server is not configured in local development. Click below to verify this email address directly through the backend verification endpoint.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={() => navigate(`/verify-email?token=${devToken}`)}
                leftIcon={<Icon name="UserCheck" size={16} />}
              >
                Verify Email (Local Development)
              </Button>
            </div>
          )}

          {resendMessage && (
            <div className="p-2.5 rounded-lg bg-surface border border-border text-xs text-muted-foreground">
              {resendMessage}
            </div>
          )}

          <div className="pt-2 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="text-xs text-primary hover:underline disabled:opacity-50 flex items-center gap-1.5"
            >
              <Icon name="Refresh" size={12} />
              <span>{isResending ? 'Sending new link...' : "Didn't receive an email? Resend link"}</span>
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create Workspace Account"
      subtitle="Start hiring with autonomous voice & rubric intelligence"
      footer={
        <p className="text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {errorMessage && (
          <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <Icon name="Error" size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            placeholder="Jane"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label="Last Name"
            placeholder="Recruiter"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

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

        <div>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="At least 8 characters"
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
            autoComplete="new-password"
          />

          {/* Password complexity checklist */}
          <div className="grid grid-cols-2 gap-1.5 mt-2.5 p-2.5 bg-muted/50 rounded-lg text-[11px]">
            <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
              <Icon name={hasMinLength ? 'Success' : 'Security'} size={12} />
              <span>8+ characters</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
              <Icon name={hasUppercase ? 'Success' : 'Security'} size={12} />
              <span>Uppercase letter</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasLowercase ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
              <Icon name={hasLowercase ? 'Success' : 'Security'} size={12} />
              <span>Lowercase letter</span>
            </div>
            <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-accent font-medium' : 'text-muted-foreground'}`}>
              <Icon name={hasNumber ? 'Success' : 'Security'} size={12} />
              <span>At least 1 number</span>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isSubmitting}
          loadingText="Creating account..."
        >
          Create Account
        </Button>
      </form>
    </AuthLayout>
  );
};
