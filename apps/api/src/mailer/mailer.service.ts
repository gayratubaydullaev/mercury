import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailerService {
  private transporter: Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get('SMTP_HOST');
    const port = this.config.get('SMTP_PORT');
    const user = this.config.get('SMTP_USER');
    const pass = this.config.get('SMTP_PASS');
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port ? Number(port) : 587,
        secure: port === '465',
        auth: { user, pass },
      });
    }
  }

  async sendMail(options: { to: string; subject: string; text: string; html?: string }): Promise<void> {
    const from = this.config.get('MAIL_FROM') || this.config.get('SMTP_USER') || 'noreply@myshop.uz';
    if (this.transporter) {
      await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html ?? options.text,
      });
    } else if (process.env.NODE_ENV !== 'test') {
      console.log(`[Mail] To: ${options.to}, Subject: ${options.subject}, Body: ${options.text}`);
    }
  }
}
