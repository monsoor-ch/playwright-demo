const { XrayConfigManager } = require('./src/config/xray-config');
const { Logger } = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

class XrayReporterSimple {
  constructor(options = {}) {
    this.options = options;
    this.testResults = new Map();
    this.startTime = Date.now();
    this.logger = Logger.getInstance();
  }

  onBegin(config, suite) {
    this.logger.info('Xray Reporter (Simple): Test execution started');
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
    this.logger.info('Xray Reporter (Simple): Test execution completed');
    
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
      const config = XrayConfigManager.getInstance();
      
      // Log test results locally
      this.logger.info('=== Test Execution Summary ===');
      this.logger.info(`Total Tests: ${results.length}`);
      
      const passedTests = results.filter(r => r.status === 'PASSED').length;
      const failedTests = results.filter(r => r.status === 'FAILED').length;
      const skippedTests = results.filter(r => r.status === 'SKIPPED').length;
      
      this.logger.info(`Passed: ${passedTests}`);
      this.logger.info(`Failed: ${failedTests}`);
      this.logger.info(`Skipped: ${skippedTests}`);
      this.logger.info('');
      
      // Log individual test results
      results.forEach(test => {
        const statusIcon = test.status === 'PASSED' ? '✅' : test.status === 'FAILED' ? '❌' : '⏭️';
        this.logger.info(`${statusIcon} ${test.testKey}: ${test.status} - ${test.comment?.split('\n')[0]}`);
      });
      
      this.logger.info('=== End Test Execution Summary ===');
      
      // Save test results to file for manual review
      if (this.options.outputDir) {
        const outputFile = path.join(this.options.outputDir, 'xray-test-results.json');
        const testResultsData = {
          timestamp: new Date().toISOString(),
          project: config.getConfig().projectKey,
          environment: config.getConfig().environment,
          version: config.getConfig().version,
          totalTests: results.length,
          passed: passedTests,
          failed: failedTests,
          skipped: skippedTests,
          tests: results
        };
        
        fs.writeFileSync(outputFile, JSON.stringify(testResultsData, null, 2));
        this.logger.info(`Test results saved to: ${outputFile}`);
      }
      
      this.logger.info('✅ Test execution completed successfully!');
      this.logger.info('📋 Test results have been logged and saved locally');
      this.logger.info('🔧 To integrate with Xray, you need admin permissions in the XSP project');
      
    } catch (error) {
      this.logger.error(`Failed to report test results: ${error}`);
      throw error;
    }
  }
}

module.exports = XrayReporterSimple;
