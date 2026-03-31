import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailAdapter {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.MAIL_PORT) || 587,
      secure: process.env.MAIL_SECURE === 'true',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const from = `"${process.env.MAIL_FROM_NAME || 'ShivAI Support'}" <${process.env.MAIL_FROM_EMAIL || process.env.MAIL_USER}>`;

      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      console.log(`[Email-Adapter] Successfully sent email to ${options.to}`);
    } catch (error) {
      console.error(`[Email-Adapter] Failed to send email to ${options.to}`, error);
      throw new Error('Failed to send email');
    }
  }
}

// Export a singleton instance
export const emailAdapter = new EmailAdapter();
