import * as nodemailer from 'nodemailer';
import * as imaps from 'imap-simple';
import { TestConfig } from '../config/test-config';
import { Logger } from './logger';

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
}

export interface EmailSearchCriteria {
  from?: string;
  to?: string;
  subject?: string;
  since?: Date;
  unseen?: boolean;
}

export class EmailValidator {
  private transporter: nodemailer.Transporter;
  private logger: Logger;
  private config: TestConfig;

  constructor() {
    this.config = TestConfig.getInstance();
    this.logger = Logger.getInstance();

    const emailConfig = this.config.email;
    if (!emailConfig.user || !emailConfig.password) {
      throw new Error('Email credentials are not configured');
    }

    this.transporter = nodemailer.createTransporter({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.password,
      },
    });

    this.logger.info('Email validator initialized');
  }

  /**
   * Send a test email
   */
  async sendEmail(to: string, subject: string, body: string, attachments?: string[]): Promise<void> {
    try {
      const mailOptions = {
        from: this.config.email.user,
        to,
        subject,
        text: body,
        html: body.includes('<') ? body : undefined,
        attachments: attachments?.map(path => ({ path }))
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.info(`Email sent successfully`, {
        messageId: info.messageId,
        to,
        subject
      });
    } catch (error) {
      this.logger.error('Failed to send email', { to, subject, error });
      throw error;
    }
  }

  /**
   * Connect to IMAP server and read emails
   */
  async connectToMailbox(): Promise<imaps.ImapSimple> {
    const config = {
      imap: {
        user: this.config.email.user,
        password: this.config.email.password,
        host: this.config.email.host.replace('smtp', 'imap'),
        port: 993,
        tls: true,
        authTimeout: 3000,
        tlsOptions: { rejectUnauthorized: false }
      }
    };

    try {
      const connection = await imaps.connect(config);
      this.logger.info('Connected to IMAP server successfully');
      return connection;
    } catch (error) {
      this.logger.error('Failed to connect to IMAP server', { error });
      throw error;
    }
  }

  /**
   * Search for emails based on criteria
   */
  async searchEmails(criteria: EmailSearchCriteria, maxResults: number = 10): Promise<EmailMessage[]> {
    let connection: imaps.ImapSimple | null = null;

    try {
      connection = await this.connectToMailbox();
      await connection.openBox('INBOX');

      // Build search criteria
      const searchCriteria: any[] = ['ALL'];
      
      if (criteria.from) {
        searchCriteria.push(['FROM', criteria.from]);
      }
      
      if (criteria.to) {
        searchCriteria.push(['TO', criteria.to]);
      }
      
      if (criteria.subject) {
        searchCriteria.push(['SUBJECT', criteria.subject]);
      }
      
      if (criteria.since) {
        searchCriteria.push(['SINCE', criteria.since]);
      }
      
      if (criteria.unseen) {
        searchCriteria.push('UNSEEN');
      }

      const searchResults = await connection.search(searchCriteria, {
        bodies: 'TEXT',
        markSeen: false,
        struct: true
      });

      const emails: EmailMessage[] = [];
      const limitedResults = searchResults.slice(0, maxResults);

      for (const message of limitedResults) {
        const email = await this.parseEmailMessage(message);
        emails.push(email);
      }

      this.logger.info(`Found ${emails.length} emails matching criteria`);
      return emails;

    } catch (error) {
      this.logger.error('Failed to search emails', { criteria, error });
      throw error;
    } finally {
      if (connection) {
        connection.end();
      }
    }
  }

  /**
   * Wait for email with specific criteria
   */
  async waitForEmail(
    criteria: EmailSearchCriteria, 
    timeoutMs: number = 30000, 
    pollIntervalMs: number = 5000
  ): Promise<EmailMessage | null> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const emails = await this.searchEmails(criteria, 1);
        if (emails.length > 0) {
          this.logger.info('Email found matching criteria');
          return emails[0];
        }

        this.logger.debug(`Email not found yet, waiting ${pollIntervalMs}ms...`);
        await this.wait(pollIntervalMs);
      } catch (error) {
        this.logger.warn('Error during email search, retrying...', { error });
        await this.wait(pollIntervalMs);
      }
    }

    this.logger.warn(`Email not found within timeout period: ${timeoutMs}ms`);
    return null;
  }

  /**
   * Validate email content
   */
  async validateEmailContent(
    criteria: EmailSearchCriteria,
    expectedContent: string,
    exactMatch: boolean = false
  ): Promise<boolean> {
    try {
      const emails = await this.searchEmails(criteria, 1);
      
      if (emails.length === 0) {
        this.logger.error('No emails found matching criteria');
        return false;
      }

      const email = emails[0];
      const contentMatches = exactMatch 
        ? email.body === expectedContent
        : email.body.includes(expectedContent);

      if (contentMatches) {
        this.logger.info('Email content validation passed');
        return true;
      } else {
        this.logger.error('Email content validation failed', {
          expected: expectedContent,
          actual: email.body.substring(0, 200) + '...'
        });
        return false;
      }
    } catch (error) {
      this.logger.error('Email content validation error', { error });
      return false;
    }
  }

  /**
   * Mark emails as read
   */
  async markEmailsAsRead(criteria: EmailSearchCriteria): Promise<void> {
    let connection: imaps.ImapSimple | null = null;

    try {
      connection = await this.connectToMailbox();
      await connection.openBox('INBOX');

      const searchCriteria: any[] = this.buildSearchCriteria(criteria);
      const searchResults = await connection.search(searchCriteria);

      if (searchResults.length > 0) {
        await connection.addFlags(searchResults, '\\Seen');
        this.logger.info(`Marked ${searchResults.length} emails as read`);
      }
    } catch (error) {
      this.logger.error('Failed to mark emails as read', { error });
      throw error;
    } finally {
      if (connection) {
        connection.end();
      }
    }
  }

  /**
   * Delete emails matching criteria
   */
  async deleteEmails(criteria: EmailSearchCriteria): Promise<void> {
    let connection: imaps.ImapSimple | null = null;

    try {
      connection = await this.connectToMailbox();
      await connection.openBox('INBOX');

      const searchCriteria: any[] = this.buildSearchCriteria(criteria);
      const searchResults = await connection.search(searchCriteria);

      if (searchResults.length > 0) {
        await connection.addFlags(searchResults, '\\Deleted');
        await connection.expunge();
        this.logger.info(`Deleted ${searchResults.length} emails`);
      }
    } catch (error) {
      this.logger.error('Failed to delete emails', { error });
      throw error;
    } finally {
      if (connection) {
        connection.end();
      }
    }
  }

  /**
   * Parse email message from IMAP response
   */
  private async parseEmailMessage(message: any): Promise<EmailMessage> {
    const header = message.parts.find((part: any) => part.which === 'HEADER')?.body;
    const body = message.parts.find((part: any) => part.which === 'TEXT')?.body || '';

    return {
      id: message.attributes.uid.toString(),
      from: header?.from?.[0] || '',
      to: header?.to?.[0] || '',
      subject: header?.subject?.[0] || '',
      body: body,
      date: header?.date?.[0] ? new Date(header.date[0]) : new Date(),
    };
  }

  /**
   * Build search criteria array for IMAP
   */
  private buildSearchCriteria(criteria: EmailSearchCriteria): any[] {
    const searchCriteria: any[] = ['ALL'];
    
    if (criteria.from) searchCriteria.push(['FROM', criteria.from]);
    if (criteria.to) searchCriteria.push(['TO', criteria.to]);
    if (criteria.subject) searchCriteria.push(['SUBJECT', criteria.subject]);
    if (criteria.since) searchCriteria.push(['SINCE', criteria.since]);
    if (criteria.unseen) searchCriteria.push('UNSEEN');

    return searchCriteria;
  }

  /**
   * Wait helper method
   */
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close connection and cleanup
   */
  async cleanup(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.logger.info('Email transporter closed');
    }
  }
}
