import { Reporter, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import { XrayClient, XrayTestResult } from './xray-client';
import { XrayConfigManager } from '../config/xray-config';
import { Logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

export interface XrayReporterOptions {
  testExecutionKey?: string;
  testPlanKey?: string;
  environment?: string;
  version?: string;
  reporter?: string;
  outputDir?: string;
}

export class XrayReporter implements Reporter {
  private xrayClient: XrayClient;
  private config: XrayConfigManager;
  private logger: Logger;
  private options: XrayReporterOptions;
  private testResults: Map<string, XrayTestResult> = new Map();
  private testExecutionKey?: string;
  private startTime: number = Date.now();

  constructor(options: XrayReporterOptions = {}) {
    this.options = options;
    this.xrayClient = XrayClient.getInstance();
    this.config = XrayConfigManager.getInstance();
    this.logger = Logger.getInstance();
  }

  onBegin(config: any, suite: any) {
    this.logger.info('Xray Reporter: Test execution started');
    this.startTime = Date.now();
  }

  onTestBegin(test: TestCase, result: TestResult) {
    // Extract test case key from test title or annotations
    const testKey = this.extractTestKey(test);
    if (testKey) {
      this.testResults.set(test.id, {
        testKey,
        status: 'EXECUTING',
        comment: `Test started: ${test.title}`,
        executionTime: 0
      });
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const testKey = this.extractTestKey(test);
    if (testKey) {
      const status = this.mapTestStatus(result.status);
      const executionTime = result.duration || 0;
      
      const xrayResult: XrayTestResult = {
        testKey,
        status,
        comment: this.generateTestComment(test, result),
        executionTime,
        evidence: this.generateEvidence(test, result)
      };

      this.testResults.set(test.id, xrayResult);
      this.logger.info(`Test ${testKey} completed with status: ${status}`);
    }
  }

  async onEnd(result: any) {
    this.logger.info('Xray Reporter: Test execution completed');
    
    try {
      if (this.config.validateConfig()) {
        await this.reportToXray();
      } else {
        this.logger.warn('Xray configuration is incomplete. Skipping Xray reporting.');
      }
    } catch (error) {
      this.logger.error(`Failed to report to Xray: ${error}`);
    }
  }

  private extractTestKey(test: TestCase): string | null {
    // Try to extract test case key from test title (e.g., "PROJ-123: Test description")
    const titleMatch = test.title.match(/^([A-Z]+-\d+):/);
    if (titleMatch) {
      return titleMatch[1];
    }

    // Try to extract from test annotations if available
    if (test.annotations) {
      const xrayAnnotation = test.annotations.find(ann => ann.type === 'xray');
      if (xrayAnnotation) {
        return xrayAnnotation.description;
      }
    }

    // Try to extract from test file path or other metadata
    const fileName = path.basename(test.location?.file || '');
    const fileMatch = fileName.match(/^([A-Z]+-\d+)/);
    if (fileMatch) {
      return fileMatch[1];
    }

    return null;
  }

  private mapTestStatus(playwrightStatus: string): 'PASSED' | 'FAILED' | 'SKIPPED' | 'TODO' {
    switch (playwrightStatus) {
      case 'passed':
        return 'PASSED';
      case 'failed':
        return 'FAILED';
      case 'skipped':
        return 'SKIPPED';
      case 'timedOut':
        return 'FAILED';
      default:
        return 'FAILED';
    }
  }

  private generateTestComment(test: TestCase, result: TestResult): string {
    let comment = `Test: ${test.title}\n`;
    comment += `Status: ${result.status}\n`;
    comment += `Duration: ${result.duration}ms\n`;
    
    if (result.error) {
      comment += `Error: ${result.error.message}\n`;
    }

    if (result.attachments) {
      comment += `Attachments: ${result.attachments.length} file(s)\n`;
    }

    return comment;
  }

  private generateEvidence(test: TestCase, result: TestResult): string[] {
    const evidence: string[] = [];
    
    if (result.attachments) {
      result.attachments.forEach(attachment => {
        if (attachment.path) {
          evidence.push(attachment.path);
        }
      });
    }

    // Add screenshot if test failed
    if (result.status === 'failed' && result.error) {
      const screenshotPath = `test-results/failure-${test.title.replace(/\s+/g, '-')}-${Date.now()}.png`;
      if (fs.existsSync(screenshotPath)) {
        evidence.push(screenshotPath);
      }
    }

    return evidence;
  }

  private async reportToXray(): Promise<void> {
    const results = Array.from(this.testResults.values());
    if (results.length === 0) {
      this.logger.warn('No test results to report to Xray');
      return;
    }

    try {
      // Use existing test execution key or create new one
      if (this.options.testExecutionKey) {
        this.testExecutionKey = this.options.testExecutionKey;
        await this.xrayClient.addTestsToExecution(this.testExecutionKey, results);
      } else {
        // Create new test execution
        const executionInfo = {
          summary: `Automated Test Execution - ${new Date().toISOString()}`,
          description: `Playwright test execution completed in ${Date.now() - this.startTime}ms`,
          testEnvironments: [this.options.environment || this.config.getConfig().environment],
          testPlanKey: this.options.testPlanKey,
          version: this.options.version || this.config.getConfig().version,
          user: this.config.getConfig().jiraUsername
        };

        this.testExecutionKey = await this.xrayClient.createTestExecution({
          info: executionInfo,
          tests: results
        });
      }

      // Update execution status
      const hasFailures = results.some(r => r.status === 'FAILED');
      const finalStatus = hasFailures ? 'FAILED' : 'PASSED';
      await this.xrayClient.updateTestExecutionStatus(this.testExecutionKey!, finalStatus);

      this.logger.info(`Successfully reported ${results.length} test results to Xray. Test Execution: ${this.testExecutionKey}`);
      
      // Save test execution key to file for reference
      if (this.options.outputDir) {
        const outputFile = path.join(this.options.outputDir, 'xray-execution-key.txt');
        fs.writeFileSync(outputFile, this.testExecutionKey);
      }

    } catch (error) {
      this.logger.error(`Failed to report test results to Xray: ${error}`);
      throw error;
    }
  }
}

