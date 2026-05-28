import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('MAIL_HOST');
    const port = this.config.get<number>('MAIL_PORT');
    if (!host || !port) {
      this.transporter = null;
      this.logger.warn(
        'MAIL_HOST/MAIL_PORT not set; emails will be logged only.',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: this.config.get<string>('MAIL_USER')
        ? {
            user: this.config.get<string>('MAIL_USER'),
            pass: this.config.get<string>('MAIL_PASS') ?? '',
          }
        : undefined,
    });
  }

  async sendVerificationEmail(to: string, token: string) {
    const webUrl =
      this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:5173';
    const link = `${webUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
    const from =
      this.config.get<string>('MAIL_FROM') ??
      'Numbers Dont Lie <no-reply@localhost>';

    const text = `Verify your email for Numbers Dont Lie by opening:\n${link}\n\nThis link expires in 48 hours.`;

    if (!this.transporter) {
      this.logger.log(`[mail skipped] To: ${to}\n${text}`);
      return;
    }

    await this.transporter.sendMail({
      from,
      to,
      subject: 'Verify your email',
      text,
    });
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const webUrl =
      this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:5173';
    const link = `${webUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    const from =
      this.config.get<string>('MAIL_FROM') ??
      'Numbers Dont Lie <no-reply@localhost>';

    const text = `Reset your Numbers Dont Lie password using this link (valid for 1 hour):\n${link}\n\nIf you did not request this, you can ignore this email.`;

    if (!this.transporter) {
      this.logger.log(`[mail skipped] To: ${to}\n${text}`);
      return;
    }

    await this.transporter.sendMail({
      from,
      to,
      subject: 'Reset your password',
      text,
    });
  }

  async sendEmailChangeVerificationEmail(to: string, token: string) {
    const webUrl =
      this.config.get<string>('WEB_APP_URL') ?? 'http://localhost:5173';
    const link = `${webUrl.replace(/\/$/, '')}/confirm-email-change?token=${encodeURIComponent(token)}`;
    const from =
      this.config.get<string>('MAIL_FROM') ??
      'Numbers Dont Lie <no-reply@localhost>';

    const text = `Confirm your new email for Numbers Dont Lie:\n${link}\n\nThis link expires in 24 hours.`;

    if (!this.transporter) {
      this.logger.log(`[mail skipped] To: ${to}\n${text}`);
      return;
    }

    await this.transporter.sendMail({
      from,
      to,
      subject: 'Confirm your new email',
      text,
    });
  }

  async sendWellnessReminderEmail(
    to: string,
    subject: string,
    message: string,
  ) {
    const from =
      this.config.get<string>('MAIL_FROM') ??
      'Numbers Dont Lie <no-reply@localhost>';
    if (!this.transporter) {
      this.logger.log(`[mail skipped] To: ${to}\n${subject}\n${message}`);
      return;
    }
    await this.transporter.sendMail({
      from,
      to,
      subject,
      text: message,
    });
  }
}
