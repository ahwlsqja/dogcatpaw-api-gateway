// api-gateway/src/email/email.processor.ts
import { OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { envVariableKeys } from 'src/common/const/env.const';

export interface SendEmailJob {
  to: string;
  subject: string;
  html: string;
}

@Processor('email')
@Injectable()
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>(envVariableKeys.emailuser),
        pass: this.configService.get<string>(envVariableKeys.emailpassword),
      },
    });

    this.logger.log('Email Processor initialized');
  }

  @OnQueueActive()
  onActive(job: Job<SendEmailJob>) {
    this.logger.log(`Processing job ${job.id} - Sending email to: ${job.data.to}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<SendEmailJob>, result: any) {
    this.logger.log(`Job ${job.id} completed - Email sent to: ${job.data.to}`);
  }

  @OnQueueFailed()
  onFailed(job: Job<SendEmailJob>, error: Error) {
    this.logger.error(
      `❌ Job ${job.id} failed - Email to: ${job.data.to} | Attempt: ${job.attemptsMade}/${job.opts.attempts}`,
      error.stack
    );
  }

  @Process('send-verification')
  async handleSendEmail(job: Job<SendEmailJob>) {
    const { to, subject, html } = job.data;

    try {
      const startTime = Date.now();

      await this.transporter.sendMail({
        from: this.configService.get<string>(envVariableKeys.emailuser),
        to,
        subject,
        html,
      });

      const duration = Date.now() - startTime;
      this.logger.debug(`SMTP send took ${duration}ms for ${to}`);

      return { success: true, to, duration };
    } catch (error) {
      this.logger.error(`SMTP error for ${to}:`, error.message);
      throw error; // Bull will retry
    }
  }
}
