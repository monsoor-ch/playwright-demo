const { XrayClientHybrid } = require('./src/utils/xray-client-hybrid');
const { XrayConfigManager } = require('./src/config/xray-config');
const { Logger } = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

class XrayReporterHybrid {
  constructor(options = {}) {
    this.options = options;
    this.testResults = new Map();
    this.startTime = Date.now();
    this.logger = Logger.getInstance();
  }

  onBegin(config, suite) {
    this.logger.info('Xray Reporter (Hybrid): Test execution started');
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
    this.logger.info('Xray Reporter (Hybrid): Test execution completed');
    
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
    // Try to extract test case key from test title (e.g., "XSP-58: Test description")
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
    comment += `Duration: ${result.duration || 0}ms\n`;
    
    if (result.error) {
      comment += `Error: ${result.error.message}\n`;
    }
    
    return comment;
  }

  generateEvidence(test, result) {
    const evidence = [];
    
    if (result.attachments) {
      result.attachments.forEach(attachment => {
        evidence.push(attachment.path);
      });
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
      const xrayClient = XrayClientHybrid.getInstance();
      const config = XrayConfigManager.getInstance();
      
      this.logger.info('=== Starting Xray Integration ===');
      
      // Step 1: Update test case statuses (for existing test cases)
      this.logger.info('Updating test case statuses...');
      await xrayClient.updateAllTestCaseStatuses(results);
      
      // Step 2: Add execution comments to existing test cases
      this.logger.info('Adding execution comments to test cases...');
      let commentSuccessCount = 0;
      for (const test of results) {
        const success = await xrayClient.addTestExecutionComment(
          test.testKey, 
          test.status, 
          test.executionTime, 
          test.comment
        );
        if (success) commentSuccessCount++;
      }
      
      // Step 3: Create test execution (if we have existing test cases)
      this.logger.info('Creating test execution...');
      const executionInfo = {
        summary: `Automated Test Execution - ${new Date().toISOString()}`,
        description: `Playwright test execution completed in ${Date.now() - this.startTime}ms\n\nTest Results:\n${results.map(r => `- ${r.testKey}: ${r.status}`).join('\n')}`,
        testEnvironments: [this.options.environment || config.getConfig().environment],
        testPlanKey: this.options.testPlanKey,
        version: this.options.version || config.getConfig().version,
        user: config.getConfig().jiraUsername
      };

      const testExecutionKey = await xrayClient.createTestExecution({
        info: executionInfo,
        tests: results
      });

      // Step 4: Log comprehensive summary
      this.logger.info('=== Xray Integration Summary ===');
      if (testExecutionKey) {
        this.logger.info(`✅ Test Execution Created: ${testExecutionKey}`);
      } else {
        this.logger.info(`⚠️  Test Execution: Could not create (no existing test cases found)`);
      }
      this.logger.info(`✅ Test Cases Processed: ${results.length}`);
      this.logger.info(`✅ Comments Added: ${commentSuccessCount}/${results.length}`);
      this.logger.info(`✅ Status Updates: ${results.map(r => `${r.testKey} -> ${r.status}`).join(', ')}`);
      this.logger.info('=== End Xray Integration Summary ===');
      
      // Save results to file for reference
      if (this.options.outputDir) {
        const outputFile = path.join(this.options.outputDir, 'xray-integration-results.json');
        const resultsData = {
          timestamp: new Date().toISOString(),
          testExecutionKey: testExecutionKey,
          testResults: results,
          summary: {
            totalTests: results.length,
            commentsAdded: commentSuccessCount,
            executionCreated: !!testExecutionKey
          }
        };
        fs.writeFileSync(outputFile, JSON.stringify(resultsData, null, 2));
        this.logger.info(`Integration results saved to: ${outputFile}`);
      }

      if (testExecutionKey) {
        this.logger.info(`🎉 Successfully integrated with Xray! Test Execution: ${testExecutionKey}`);
      } else {
        this.logger.info(`📋 Partial integration completed - test cases updated but execution not created`);
        this.logger.info(`🔧 To create test executions, ensure test cases exist in Xray Test Repository`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to report test results to Xray: ${error}`);
      throw error;
    }
  }
}

module.exports = XrayReporterHybrid;
