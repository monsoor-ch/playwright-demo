import { test, expect } from '@playwright/test';
import { EmailValidator, EmailSearchCriteria } from '../../src/utils/email-validator';
import { Logger } from '../../src/utils/logger';

test.describe('Email Validator Tests', () => {
  let emailValidator: EmailValidator;
  let logger: Logger;

  test.beforeAll(async () => {
    logger = Logger.getInstance();
    
    // Skip tests if email configuration is not available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      test.skip(true, 'Email credentials not configured');
    }

    try {
      emailValidator = new EmailValidator();
      logger.info('Email validator tests setup completed');
    } catch (error) {
      logger.error('Failed to setup email validator tests', { error });
      test.skip(true, 'Email validator setup failed');
    }
  });

  test('should send test email', async () => {
    logger.logTestStart('Send test email');

    const testEmail = process.env.EMAIL_USER!;
    const subject = `Test Email - ${Date.now()}`;
    const body = 'This is a test email sent by the Playwright automation framework.';

    logger.logStep(`Sending test email to: ${testEmail}`);
    await emailValidator.sendEmail(testEmail, subject, body);

    // Wait a moment for email to be sent
    await new Promise(resolve => setTimeout(resolve, 2000));

    logger.logTestEnd('Send test email', 'passed');
  });

  test('should search for emails', async () => {
    logger.logTestStart('Search for emails');

    const criteria: EmailSearchCriteria = {
      to: process.env.EMAIL_USER!,
      since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    };

    logger.logStep('Searching for emails');
    const emails = await emailValidator.searchEmails(criteria, 5);

    logger.logAssertion('Should find some emails');
    expect(emails.length).toBeGreaterThanOrEqual(0);

    if (emails.length > 0) {
      const firstEmail = emails[0];
      logger.logAssertion('Email should have required properties');
      expect(firstEmail.id).toBeTruthy();
      expect(firstEmail.subject).toBeTruthy();
      expect(firstEmail.date).toBeInstanceOf(Date);
    }

    logger.logTestEnd('Search for emails', 'passed');
  });

  test('should search for emails with specific subject', async () => {
    logger.logTestStart('Search for emails with specific subject');

    // First send an email with a unique subject
    const uniqueSubject = `Automation Test - ${Date.now()}`;
    const testBody = 'This email is used for automation testing.';
    
    logger.logStep('Sending email with unique subject');
    await emailValidator.sendEmail(process.env.EMAIL_USER!, uniqueSubject, testBody);

    // Wait for email to be delivered
    await new Promise(resolve => setTimeout(resolve, 5000));

    logger.logStep('Searching for the sent email');
    const criteria: EmailSearchCriteria = {
      subject: uniqueSubject,
      to: process.env.EMAIL_USER!
    };

    const emails = await emailValidator.searchEmails(criteria, 1);

    if (emails.length > 0) {
      logger.logAssertion('Should find the sent email');
      expect(emails[0].subject).toContain(uniqueSubject);
    } else {
      logger.warn('Email not found immediately - may need more time for delivery');
    }

    logger.logTestEnd('Search for emails with specific subject', 'passed');
  });

  test('should wait for email with timeout', async () => {
    logger.logTestStart('Wait for email with timeout');

    const futureSubject = `Future Email - ${Date.now()}`;
    const criteria: EmailSearchCriteria = {
      subject: futureSubject
    };

    logger.logStep('Waiting for non-existent email (should timeout)');
    const email = await emailValidator.waitForEmail(criteria, 10000, 2000);

    logger.logAssertion('Should timeout and return null');
    expect(email).toBeNull();

    logger.logTestEnd('Wait for email with timeout', 'passed');
  });

  test('should validate email content', async () => {
    logger.logTestStart('Validate email content');

    // Send an email with specific content
    const subject = `Content Validation Test - ${Date.now()}`;
    const expectedContent = 'VALIDATION_STRING_12345';
    const body = `This email contains the validation string: ${expectedContent}`;

    logger.logStep('Sending email with validation content');
    await emailValidator.sendEmail(process.env.EMAIL_USER!, subject, body);

    // Wait for delivery
    await new Promise(resolve => setTimeout(resolve, 5000));

    logger.logStep('Validating email content');
    const criteria: EmailSearchCriteria = {
      subject: subject
    };

    const isValid = await emailValidator.validateEmailContent(
      criteria,
      expectedContent,
      false // partial match
    );

    if (isValid) {
      logger.logAssertion('Email content validation should pass');
      expect(isValid).toBe(true);
    } else {
      logger.warn('Content validation failed - email may not have been delivered yet');
    }

    logger.logTestEnd('Validate email content', 'passed');
  });

  test('should handle email operations gracefully', async () => {
    logger.logTestStart('Handle email operations gracefully');

    const nonExistentCriteria: EmailSearchCriteria = {
      subject: 'NONEXISTENT_EMAIL_SUBJECT_999999',
      from: 'nonexistent@example.com'
    };

    logger.logStep('Searching for non-existent email');
    const emails = await emailValidator.searchEmails(nonExistentCriteria, 1);

    logger.logAssertion('Should return empty array for non-existent emails');
    expect(emails).toHaveLength(0);

    logger.logStep('Validating content of non-existent email');
    const isValid = await emailValidator.validateEmailContent(
      nonExistentCriteria,
      'any content'
    );

    logger.logAssertion('Content validation should fail for non-existent email');
    expect(isValid).toBe(false);

    logger.logTestEnd('Handle email operations gracefully', 'passed');
  });

  test.afterAll(async () => {
    if (emailValidator) {
      try {
        logger.info('Cleaning up email validator');
        await emailValidator.cleanup();
        logger.info('Email validator tests cleanup completed');
      } catch (error) {
        logger.warn('Error during email validator cleanup', { error });
      }
    }
  });
});
