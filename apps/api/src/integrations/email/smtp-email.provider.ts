import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { EmailProvider, SendEmailOptions } from './email-provider.interface.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../common/errors/app-error.js';

export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
    });
  }

  async send(options: SendEmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: options.from || env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      logger.info({ to: options.to, subject: options.subject }, 'Email successfully dispatched via SMTP');
    } catch (error) {
      logger.error({ err: error, to: options.to }, 'Failed to deliver email via SMTP');
      throw AppError.serviceUnavailable('Email delivery failed. Please try again later.');
    }
  }
}
