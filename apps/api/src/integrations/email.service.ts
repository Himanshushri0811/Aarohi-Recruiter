import { env, isProduction } from '../config/env.js';
import { AppError } from '../common/errors/app-error.js';
import { EmailProvider } from './email/email-provider.interface.js';
import { SmtpEmailProvider } from './email/smtp-email.provider.js';
import { ConsoleEmailProvider } from './email/console-email.provider.js';
import { BrevoEmailProvider } from './email/brevo-email.provider.js';

let _provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (_provider) return _provider;

  // Use Brevo if configured explicitly or if API key exists
  if (env.EMAIL_PROVIDER === 'brevo' || env.BREVO_API_KEY) {
    _provider = new BrevoEmailProvider();
    return _provider;
  }

  if (isProduction()) {
    if (!env.SMTP_HOST) {
      throw AppError.serviceUnavailable(
        'Email delivery provider is unconfigured in production. Please configure SMTP credentials or Brevo API key.',
      );
    }
    _provider = new SmtpEmailProvider();
    return _provider;
  }

  // Development / Test
  if (env.SMTP_HOST) {
    _provider = new SmtpEmailProvider();
  } else {
    _provider = new ConsoleEmailProvider();
  }

  return _provider;
}

export function setEmailProvider(provider: EmailProvider | null): void {
  _provider = provider;
}

export async function sendVerificationEmail(to: string, token: string): Promise<string> {
  const verificationUrl = `${env.APP_URL}/verify-email?token=${token}`;
  const provider = getEmailProvider();

  const subject = 'Verify your Aarohi Recruiter account';
  const text = `Welcome to Aarohi Recruiter!\n\nPlease verify your email address by visiting the following link:\n${verificationUrl}\n\nThis verification link is valid for 24 hours.\n\nIf you did not create an account, you can safely ignore this email.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F7FC; color: #202033; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E8E7F0; overflow: hidden; }
          .header { background: #17172B; padding: 24px; text-align: center; }
          .header h1 { color: #FFFFFF; font-size: 20px; margin: 0; }
          .content { padding: 32px 24px; }
          .button { display: inline-block; background: #7565F6; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 20px 0; }
          .footer { font-size: 11px; color: #74748A; border-top: 1px solid #E8E7F0; padding: 16px 24px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Aarohi Recruiter</h1>
          </div>
          <div class="content">
            <h2>Verify your email address</h2>
            <p>Welcome! Please confirm your email address to activate your workspace and access autonomous AI interview tools.</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email</a>
            </div>
            <p style="font-size: 12px; color: #74748A;">Or copy and paste this link in your browser:<br><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p style="font-size: 12px; color: #74748A;">This link expires in 24 hours.</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Aarohi Recruiter — Aurora Intelligence SaaS.
          </div>
        </div>
      </body>
    </html>
  `;

  await provider.send({
    to,
    subject,
    text,
    html,
  });

  return verificationUrl;
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<string> {
  const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
  const provider = getEmailProvider();

  const subject = 'Reset your Aarohi Recruiter password';
  const text = `You requested a password reset for your Aarohi Recruiter account.\n\nPlease reset your password using the following link:\n${resetUrl}\n\nThis reset link is valid for 1 hour.\n\nIf you did not request a password reset, please ignore this email.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F7FC; color: #202033; margin: 0; padding: 24px; }
          .container { max-width: 520px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E8E7F0; overflow: hidden; }
          .header { background: #17172B; padding: 24px; text-align: center; }
          .header h1 { color: #FFFFFF; font-size: 20px; margin: 0; }
          .content { padding: 32px 24px; }
          .button { display: inline-block; background: #7565F6; color: #FFFFFF !important; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 20px 0; }
          .footer { font-size: 11px; color: #74748A; border-top: 1px solid #E8E7F0; padding: 16px 24px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Aarohi Recruiter</h1>
          </div>
          <div class="content">
            <h2>Reset your password</h2>
            <p>You recently requested to reset your password. Click the button below to choose a new password.</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p style="font-size: 12px; color: #74748A;">Or copy and paste this link in your browser:<br><a href="${resetUrl}">${resetUrl}</a></p>
            <p style="font-size: 12px; color: #74748A;">This link expires in 1 hour.</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Aarohi Recruiter — Aurora Intelligence SaaS.
          </div>
        </div>
      </body>
    </html>
  `;

  await provider.send({
    to,
    subject,
    text,
    html,
  });

  return resetUrl;
}

export interface SendInterviewInviteParams {
  to: string;
  candidateName: string;
  jobTitle: string;
  durationMinutes: number;
  inviteUrl: string;
  instructions?: string;
  expiresAt: Date;
}

export async function sendInterviewInvitationEmail(params: SendInterviewInviteParams): Promise<{ messageId: string }> {
  const provider = getEmailProvider();
  const subject = `Interview Invitation: ${params.jobTitle} with Aarohi`;
  const formattedExpiry = params.expiresAt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const text = `Hello ${params.candidateName},\n\nYou have been invited to participate in an AI interview with Aarohi for the ${params.jobTitle} position.\n\nInterview duration: ~${params.durationMinutes} minutes.\nPlease join using your secure access link:\n${params.inviteUrl}\n\nThis invitation link expires on ${formattedExpiry}.\n\nGood luck,\nThe Recruiting Team`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F7FC; color: #202033; margin: 0; padding: 24px; }
          .container { max-width: 540px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E8E7F0; overflow: hidden; }
          .header { background: linear-gradient(135deg, #2563EB 0%, #4F46E5 100%); padding: 32px 24px; text-align: center; color: #FFFFFF; }
          .header h1 { font-size: 22px; margin: 0 0 6px 0; font-weight: 700; }
          .header p { font-size: 13px; opacity: 0.9; margin: 0; }
          .content { padding: 32px 24px; line-height: 1.6; }
          .info-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
          .info-label { color: #64748B; font-weight: 500; }
          .info-val { color: #0F172A; font-weight: 600; }
          .button { display: inline-block; background: #2563EB; color: #FFFFFF !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 24px 0; text-align: center; }
          .footer { font-size: 11px; color: #94A3B8; border-top: 1px solid #E8E7F0; padding: 16px 24px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Interview Invitation</h1>
            <p>Aarohi AI Recruiter</p>
          </div>
          <div class="content">
            <p>Hello <strong>${params.candidateName}</strong>,</p>
            <p>Congratulations! You have been selected for an initial voice interview with <strong>Aarohi</strong>, our AI talent partner, for the <strong>${params.jobTitle}</strong> position.</p>

            <div class="info-card">
              <div class="info-row">
                <span class="info-label">Role:</span>
                <span class="info-val">${params.jobTitle}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Interviewer:</span>
                <span class="info-val">Aarohi (AI Interviewer)</span>
              </div>
              <div class="info-row">
                <span class="info-label">Estimated Duration:</span>
                <span class="info-val">~${params.durationMinutes} minutes</span>
              </div>
              <div class="info-row">
                <span class="info-label">Link Valid Until:</span>
                <span class="info-val">${formattedExpiry}</span>
              </div>
            </div>

            ${params.instructions ? `<p style="font-size: 13px; color: #475569; background: #EFF6FF; padding: 12px; border-radius: 6px;"><strong>Note from recruiter:</strong> ${params.instructions}</p>` : ''}

            <div style="text-align: center;">
              <a href="${params.inviteUrl}" class="button">Start Your Interview</a>
            </div>

            <p style="font-size: 12px; color: #64748B;">
              Before joining, please ensure you are in a quiet room with a working microphone and camera.
            </p>
            <p style="font-size: 11px; color: #94A3B8; word-break: break-all;">
              Or copy this direct URL: ${params.inviteUrl}
            </p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Aarohi Recruiter — Aurora Intelligence.
          </div>
        </div>
      </body>
    </html>
  `;

  if (provider instanceof BrevoEmailProvider) {
    const res = await provider.sendTransactional({
      to: params.to,
      subject,
      text,
      html,
    });
    return { messageId: res.messageId };
  } else {
    await provider.send({
      to: params.to,
      subject,
      text,
      html,
    });
    return { messageId: `local-${Date.now()}` };
  }
}
