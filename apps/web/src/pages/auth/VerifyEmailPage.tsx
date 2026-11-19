import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/design-system/components/Button';
import { Input } from '@/design-system/components/Input';
import { Spinner } from '@/design-system/components/Loading/Spinner';
import { Icon } from '@/design-system/icons';
import { authApi, ApiError } from '@/lib/api';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const emailParam = searchParams.get('email') || '';

  const [state, setState] = useState<'verifying' | 'success' | 'error' | 'pending'>('pending');
  const [message, setMessage] = useState<string>('');
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false);
  const [resendEmail, setResendEmail] = useState<string>(emailParam);
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resendMsg, setResendMsg] = useState('');
  const [devVerificationUrl, setDevVerificationUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState('pending');
      return;
    }

    let isMounted = true;
    setState('verifying');

    async function executeVerification() {
      try {
        const res = await authApi.verifyEmail(token!);
        if (isMounted) {
          setState('success');
          setIsAlreadyVerified(!!res.alreadyVerified);
          setMessage(res.message || 'Your email address has been successfully verified.');
        }
      } catch (err) {
        if (isMounted) {
          setState('error');
          if (err instanceof ApiError) {
            setMessage(err.message);
          } else {
            setMessage('Failed to verify email. The token may be expired or invalid.');
          }
        }
      }
    }

    executeVerification();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;

    setResending(true);
    setResendStatus('idle');
    setResendMsg('');
    setDevVerificationUrl(null);

    try {
      const res = await authApi.resendVerification(resendEmail);
      setResendStatus('success');
      setResendMsg(res.message || 'Verification link sent if the email exists.');
      if (res.alreadyVerified) {
        setIsAlreadyVerified(true);
        setState('success');
        setMessage(res.message);
      } else if (res.devVerificationUrl) {
        setDevVerificationUrl(res.devVerificationUrl);
      }
    } catch (err) {
      setResendStatus('error');
      if (err instanceof ApiError) {
        setResendMsg(err.message);
      } else {
        setResendMsg('Failed to resend verification email.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Email Verification"
      subtitle="Confirming your credentials with Aarohi Recruiter"
      footer={
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Back to Sign In
        </Link>
      }
    >
      <div className="text-center py-4 space-y-5">
        {state === 'verifying' && (
          <div className="space-y-3 py-6">
            <Spinner size="lg" className="mx-auto text-primary" />
            <p className="text-xs text-muted-foreground">Verifying token signature with server...</p>
          </div>
        )}

        {state === 'success' && (
          <div className="space-y-4 py-2">
            <div className="h-16 w-16 mx-auto rounded-full bg-accent/15 border border-accent/40 text-accent flex items-center justify-center">
              <Icon name="Success" size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                {isAlreadyVerified ? 'Email Already Verified' : 'Email Verified!'}
              </h3>
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>
            <Button asChild variant="primary" className="w-full">
              <Link to="/login">Sign In to Workspace</Link>
            </Button>
          </div>
        )}

        {(state === 'pending' || state === 'error') && (
          <div className="space-y-5 text-left">
            {state === 'error' ? (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                <div className="font-semibold flex items-center gap-1.5 mb-1">
                  <Icon name="Error" size={14} /> Verification Failed
                </div>
                {message}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-foreground text-xs">
                <div className="font-semibold flex items-center gap-1.5 mb-1 text-primary">
                  <Icon name="Info" size={14} /> Verification Required
                </div>
                Please enter your registered email address to receive or re-issue a verification link.
              </div>
            )}

            <form onSubmit={handleResend} className="space-y-3">
              <div>
                <label htmlFor="verify-email-input" className="block text-xs font-medium text-foreground mb-1">
                  Email Address
                </label>
                <Input
                  id="verify-email-input"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
              </div>

              {resendStatus === 'success' && (
                <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs">
                  {resendMsg}
                </div>
              )}

              {resendStatus === 'error' && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  {resendMsg}
                </div>
              )}

              {devVerificationUrl && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider">
                    🛠 Local Development Bypass
                  </div>
                  <p className="text-xs text-foreground/80">
                    SMTP is not configured in this environment. You can complete verification directly:
                  </p>
                  <div className="p-2 rounded bg-background/80 font-mono text-[11px] break-all border border-border">
                    <a
                      href={devVerificationUrl}
                      className="text-primary hover:underline"
                    >
                      {devVerificationUrl}
                    </a>
                  </div>
                  <Button asChild variant="secondary" size="sm" className="w-full">
                    <a href={devVerificationUrl}>Verify Email (Local Dev)</a>
                  </Button>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={resending}
              >
                Resend Verification Email
              </Button>
            </form>

            <div className="text-center pt-2">
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Already verified? Sign in</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
