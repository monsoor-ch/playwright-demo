const { XrayClientReadOnly } = require('./src/utils/xray-client-readonly');
const { XrayConfigManager } = require('./src/config/xray-config');
const { Logger } = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

class XrayReporter {
  constructor(options = {}) {
    this.options = options;
    this.testResults = new Map();
    this.startTime = Date.now();
    this.logger = Logger.getInstance();
  }

  onBegin(config, suite) {
    this.logger.info('Xray Reporter: Test execution started');
    this.startTime = Date.now();
  }

  onTestBegin(test, result) {
    // Extract test case key from test title
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

  onTestEnd(test, result) {
    const testKey = this.extractTestKey(test);
    if (testKey) {
      const status = this.mapTestStatus(result.status);
      const executionTime = result.duration || 0;
      
      const xrayResult = {
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

  async onEnd(result) {
    this.logger.info('Xray Reporter: Test execution completed');
    
    try {
      const config = XrayConfigManager.getInstance();
      if (config.validateConfig()) {
        await this.reportToXray();
      } else {
        this.logger.warn('Xray configuration is incomplete. Skipping Xray reporting.');
      }
    } catch (error) {
      this.logger.error(`Failed to report to Xray: ${error}`);
    }
  }

  extractTestKey(test) {
    // Try to extract test case key from test title (e.g., "PROJ-123: Test description")
    const titleMatch = test.title.match(/^([A-Z]+-\d+):/);
    if (titleMatch) {
      return titleMatch[1];
    }

    // Try to extract from test file path
    const fileName = path.basename(test.location?.file || '');
    const fileMatch = fileName.match(/^([A-Z]+-\d+)/);
    if (fileMatch) {
      return fileMatch[1];
    }

    return null;
  }

  mapTestStatus(playwrightStatus) {
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

  generateTestComment(test, result) {
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

  generateEvidence(test, result) {
    const evidence = [];
    
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

  async reportToXray() {
    const results = Array.from(this.testResults.values());
    if (results.length === 0) {
      this.logger.warn('No test results to report to Xray');
      return;
    }

    try {
      const xrayClient = XrayClientReadOnly.getInstance();
      const config = XrayConfigManager.getInstance();
      
      // Log test results (read-only mode)
      this.logger.info('Logging test results...');
      await xrayClient.logTestResults(results);
      
      // Create test execution for tracking
      this.logger.info('Creating test execution for tracking...');

      // Create new test execution
      const executionInfo = {
        summary: `Automated Test Execution - ${new Date().toISOString()}`,
        description: `Playwright test execution completed in ${Date.now() - this.startTime}ms`,
        testEnvironments: [this.options.environment || config.getConfig().environment],
        testPlanKey: this.options.testPlanKey,
        version: this.options.version || config.getConfig().version,
        user: config.getConfig().jiraUsername
      };

      const testExecutionKey = await xrayClient.createTestExecution({
        info: executionInfo,
        tests: results
      });

      // Update execution status
      const hasFailures = results.some(r => r.status === 'FAILED');
      const finalStatus = hasFailures ? 'FAILED' : 'PASSED';
      await xrayClient.updateTestExecutionStatus(testExecutionKey, finalStatus);

      this.logger.info(`Successfully reported ${results.length} test results to Xray. Test Execution: ${testExecutionKey}`);
      
      // Save test execution key to file for reference
      if (this.options.outputDir) {
        const outputFile = path.join(this.options.outputDir, 'xray-execution-key.txt');
        fs.writeFileSync(outputFile, testExecutionKey);
      }

    } catch (error) {
      this.logger.error(`Failed to report test results to Xray: ${error}`);
      throw error;
    }
  }
}

module.exports = XrayReporter;

