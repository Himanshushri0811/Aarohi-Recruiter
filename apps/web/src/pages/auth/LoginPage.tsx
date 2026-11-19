import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input } from '@/design-system/components/Input';
import { Button } from '@/design-system/components/Button';
import { Icon } from '@/design-system/icons';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError, authApi } from '@/lib/api';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Email verification recovery states
  const [isEmailUnverified, setIsEmailUnverified] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [devVerificationUrl, setDevVerificationUrl] = useState<string | null>(null);
  const [devVerificationToken, setDevVerificationToken] = useState<string | null>(null);
  const [isDevVerifying, setIsDevVerifying] = useState(false);
  const [devVerifiedSuccess, setDevVerifiedSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage('Please enter both your email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (
          err.code === 'EMAIL_NOT_VERIFIED' ||
          err.statusCode === 403 ||
          err.message.toLowerCase().includes('verify your email')
        ) {
          setIsEmailUnverified(true);
          setErrorMessage('Please verify your email address before logging in.');
        } else {
          setIsEmailUnverified(false);
          setErrorMessage(err.message);
        }
      } else {
        setIsEmailUnverified(false);
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setErrorMessage('Please enter your email address to receive a verification link.');
      return;
    }

    setIsResending(true);
    setResendStatus('idle');
    setResendMessage(null);
    setDevVerificationUrl(null);
    setDevVerificationToken(null);
    setDevVerifiedSuccess(false);

    try {
      const res = await authApi.resendVerification(email);
      setResendStatus('success');
      setResendMessage(res.message);
      if (res.devVerificationUrl) {
        setDevVerificationUrl(res.devVerificationUrl);
      }
      if (res.devVerificationToken) {
        setDevVerificationToken(res.devVerificationToken);
      }
    } catch (err) {
      setResendStatus('error');
      if (err instanceof ApiError) {
        setResendMessage(err.message);
      } else {
        setResendMessage('Failed to send verification email. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleDevDirectVerify = async () => {
    if (!devVerificationToken) return;

    setIsDevVerifying(true);
    try {
      const res = await authApi.verifyEmail(devVerificationToken);
      setDevVerifiedSuccess(true);
      setIsEmailUnverified(false);
      setErrorMessage(null);
      setResendMessage(res.message || 'Email verified successfully! You can now sign in.');
    } catch (err) {
      if (err instanceof ApiError) {
        setResendMessage(err.message);
      } else {
        setResendMessage('Verification failed. Token may be expired.');
      }
    } finally {
      setIsDevVerifying(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your Aarohi enterprise workspace"
      footer={
        <div className="space-y-2 text-center text-xs text-muted-foreground">
          <p>
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </p>
          <p>
            Didn't receive verification email?{' '}
            <Link
              to={email ? `/verify-email?email=${encodeURIComponent(email)}` : '/verify-email'}
              className="font-semibold text-primary hover:underline"
            >
              Verify your email
            </Link>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && !isEmailUnverified && (
          <div className="p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <Icon name="Error" size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Dedicated Email Verification Recovery Panel */}
        {isEmailUnverified && (
          <div className="p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs space-y-3">
            <div className="flex items-start gap-2">
              <Icon name="Warning" size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-foreground">Email Verification Required</span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Your credentials are valid, but your email address has not been verified yet. Please check your inbox or request a new verification link below.
                </p>
              </div>
            </div>

            {/* Development-Only Verification Helper */}
            {devVerificationUrl && !devVerifiedSuccess && (
              <div className="p-3 rounded-md border border-primary/30 bg-secondary/70 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                  <span>🛠 Local Development Mode</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">Dev Helper</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Direct verification link:
                </p>
                <div className="p-1.5 rounded bg-background/80 font-mono text-[10px] break-all border border-border">
                  <a
                    href={devVerificationUrl}
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {devVerificationUrl}
                  </a>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleDevDirectVerify}
                  isLoading={isDevVerifying}
                  leftIcon={<Icon name="UserCheck" size={14} />}
                >
                  Verify Email Now (Local Dev)
                </Button>
              </div>
            )}

            {devVerifiedSuccess && (
              <div className="p-2.5 rounded bg-accent/15 border border-accent/30 text-accent text-xs flex items-center gap-2">
                <Icon name="Success" size={14} />
                <span>Email verified! You can now sign in with your credentials.</span>
              </div>
            )}

            {resendMessage && !devVerifiedSuccess && (
              <div className={`p-2 rounded text-[11px] ${
                resendStatus === 'error'
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-primary/10 text-foreground border border-primary/20'
              }`}>
                {resendMessage}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={handleResendVerification}
                isLoading={isResending}
                leftIcon={<Icon name="Mail" size={14} />}
              >
                Resend Verification Link
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="w-full text-xs"
              >
                <Link to={email ? `/verify-email?email=${encodeURIComponent(email)}` : '/verify-email'}>
                  Verification Page
                </Link>
              </Button>
            </div>
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

        <div>
          <Input
            label="Password"
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
            autoComplete="current-password"
          />
          <div className="flex justify-end mt-1.5">
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isSubmitting}
          loadingText="Signing in..."
        >
          Sign In
        </Button>
      </form>
    </AuthLayout>
  );
};
