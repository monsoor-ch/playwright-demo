const { XrayServerClient } = require('./src/utils/xray-server-client');
const { XrayConfigManager } = require('./src/config/xray-config');
const { Logger } = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

class XrayReporterServer {
  constructor(options = {}) {
    this.options = options;
    this.testResults = new Map();
    this.startTime = Date.now();
    this.logger = Logger.getInstance();
  }

  onBegin(config, suite) {
    this.logger.info('Xray Server Reporter: Test execution started');
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
    this.logger.info('Xray Server Reporter: Test execution completed');
    
    try {
      const config = XrayConfigManager.getInstance();
      if (config.validateConfig()) {
        await this.reportToXrayServer();
      } else {
        this.logger.warn('Xray configuration is incomplete. Skipping Xray Server reporting.');
      }
    } catch (error) {
      this.logger.error(`Failed to report to Xray Server: ${error}`);
    }
  }

  extractTestKey(test) {
    // Try to extract test case key from test title (e.g., "XSP-100: Test description")
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

  async reportToXrayServer() {
    const results = Array.from(this.testResults.values());
    if (results.length === 0) {
      this.logger.warn('No test results to report to Xray Server');
      return;
    }

    try {
      const xrayClient = XrayServerClient.getInstance();
      const config = XrayConfigManager.getInstance();
      
      this.logger.info('=== Starting Enhanced Xray Server Integration ===');
      
      // Step 1: Ensure test cases exist (find by key, find by description, or create)
      this.logger.info('Ensuring test cases exist in Xray Server...');
      let testCaseSuccessCount = 0;
      for (const test of results) {
        // Extract test title from comment (first line)
        const testTitle = test.comment.split('\n')[0].replace('Test: ', '');
        const testDescription = test.comment;
        
        const testCaseKey = await xrayClient.ensureTestCaseExists(test.testKey, testTitle, testDescription);
        if (testCaseKey) {
          testCaseSuccessCount++;
          // Update the test key in case it was found by description
          test.testKey = testCaseKey;
        }
      }
      
      // Step 2: Update test case statuses with proper test executions
      this.logger.info('Updating test case statuses with test executions in Xray Server...');
      let statusSuccessCount = 0;
      for (const test of results) {
        const success = await xrayClient.updateTestCaseStatus(
          test.testKey, 
          test.status, 
          test.executionTime, 
          test.comment
        );
        if (success) statusSuccessCount++;
      }
      
      // Step 3: Log comprehensive summary
      this.logger.info('=== Enhanced Xray Server Integration Summary ===');
      this.logger.info(`✅ Test Cases Processed: ${testCaseSuccessCount}/${results.length}`);
      this.logger.info(`✅ Test Executions Created: ${statusSuccessCount}/${results.length}`);
      this.logger.info(`✅ Status Updates: ${results.map(r => `${r.testKey} -> ${r.status}`).join(', ')}`);
      this.logger.info('=== End Enhanced Xray Server Integration Summary ===');
      
      // Save results to file for reference
      if (this.options.outputDir) {
        const outputFile = path.join(this.options.outputDir, 'xray-server-results.json');
        const resultsData = {
          timestamp: new Date().toISOString(),
          testResults: results,
          summary: {
            totalTests: results.length,
            testCasesProcessed: testCaseSuccessCount,
            testExecutionsCreated: statusSuccessCount
          }
        };
        fs.writeFileSync(outputFile, JSON.stringify(resultsData, null, 2));
        this.logger.info(`Xray Server results saved to: ${outputFile}`);
      }

      if (statusSuccessCount > 0) {
        this.logger.info(`🎉 Successfully integrated with Xray Server! Created ${statusSuccessCount} test executions`);
      } else {
        this.logger.info(`📋 Integration completed - test cases processed but no executions created`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to report test results to Xray Server: ${error}`);
      throw error;
    }
  }
}

module.exports = XrayReporterServer;
