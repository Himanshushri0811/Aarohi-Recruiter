export interface SendEmailOptions {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  send(options: SendEmailOptions): Promise<void>;
}
