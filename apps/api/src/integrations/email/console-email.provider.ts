import { EmailProvider, SendEmailOptions } from './email-provider.interface.js';
import { logger } from '../../config/logger.js';

export class ConsoleEmailProvider implements EmailProvider {
  async send(options: SendEmailOptions): Promise<void> {
    logger.info(
      {
        to: options.to,
        subject: options.subject,
      },
      `[DEV EMAIL DISPATCH] Recipient: ${options.to} | Subject: ${options.subject}`,
    );
  }
}
