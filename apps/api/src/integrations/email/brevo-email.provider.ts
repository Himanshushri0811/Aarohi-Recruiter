import { EmailProvider, SendEmailOptions } from './email-provider.interface.js';
import { env } from '../../config/env.js';
import { AppError } from '../../common/errors/app-error.js';
import { logger } from '../../config/logger.js';

export interface BrevoSendResult {
  messageId: string;
}

export class BrevoEmailProvider implements EmailProvider {
  private apiKey: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.apiKey = env.BREVO_API_KEY || '';
    this.fromEmail = env.EMAIL_FROM_ADDRESS || 'hshrivastava1108@gmail.com';
    this.fromName = env.EMAIL_FROM_NAME || 'Aarohi Recruiter';

    if (!this.apiKey) {
      logger.warn('[BrevoEmailProvider] BREVO_API_KEY is not configured.');
    }
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!this.apiKey) {
      throw AppError.serviceUnavailable('Brevo email provider is not configured: missing BREVO_API_KEY');
    }

    const payload = {
      sender: {
        name: this.fromName,
        email: options.from || this.fromEmail,
      },
      to: [
        {
          email: options.to,
        },
      ],
      subject: options.subject,
      htmlContent: options.html,
      textContent: options.text,
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error({ status: response.status, body: errorBody }, '[BrevoEmailProvider] Email dispatch failed');
      throw AppError.internal(`Brevo email sending failed: ${response.statusText} (${errorBody})`);
    }

    const result = (await response.json()) as BrevoSendResult;
    logger.info({ messageId: result.messageId, to: options.to }, '[BrevoEmailProvider] Email successfully dispatched');
  }

  async sendTransactional(options: SendEmailOptions): Promise<BrevoSendResult> {
    if (!this.apiKey) {
      throw AppError.serviceUnavailable('Brevo email provider is not configured: missing BREVO_API_KEY');
    }

    const payload = {
      sender: {
        name: this.fromName,
        email: options.from || this.fromEmail,
      },
      to: [
        {
          email: options.to,
        },
      ],
      subject: options.subject,
      htmlContent: options.html,
      textContent: options.text,
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error({ status: response.status, body: errorBody }, '[BrevoEmailProvider] Email dispatch failed');
      throw AppError.internal(`Brevo email sending failed: ${response.statusText} (${errorBody})`);
    }

    const result = (await response.json()) as BrevoSendResult;
    logger.info({ messageId: result.messageId, to: options.to }, '[BrevoEmailProvider] Email successfully dispatched');
    return result;
  }
}
