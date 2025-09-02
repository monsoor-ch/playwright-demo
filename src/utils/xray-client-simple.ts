import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { XrayConfigManager } from '../config/xray-config';
import { Logger } from './logger';

export interface XrayTestResult {
  testKey: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'TODO' | 'EXECUTING';
  comment?: string;
  evidence?: string[];
  executionTime?: number;
  defects?: string[];
}

export interface XrayTestExecution {
  testExecutionKey: string;
  info: {
    summary: string;
    description?: string;
    testEnvironments?: string[];
    testPlanKey?: string;
    version?: string;
    revision?: string;
    user?: string;
    startDate?: string;
    finishDate?: string;
    testExecutionKey?: string;
  };
  tests: XrayTestResult[];
}

export class XrayClient {
  private static instance: XrayClient;
  private axiosInstance: AxiosInstance;
  private config: XrayConfigManager;
  private logger: Logger;

  private constructor() {
    this.config = XrayConfigManager.getInstance();
    this.logger = Logger.getInstance();
    
    this.axiosInstance = axios.create({
      baseURL: this.config.getXrayApiUrl(),
      auth: {
        username: this.config.getConfig().jiraUsername,
        password: this.config.getConfig().jiraApiToken
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.info(`Xray API call successful: ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error(`Xray API call failed: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): XrayClient {
    if (!XrayClient.instance) {
      XrayClient.instance = new XrayClient();
    }
    return XrayClient.instance;
  }

  /**
   * Create a new test execution in Jira Xray
   */
  public async createTestExecution(execution: Omit<XrayTestExecution, 'testExecutionKey'>): Promise<string> {
    try {
      // Use only basic fields that exist in most Jira instances
      const response: AxiosResponse = await this.axiosInstance.post('/issue', {
        fields: {
          project: {
            key: this.config.getConfig().projectKey
          },
          summary: execution.info.summary,
          description: `${execution.info.description || 'Automated test execution from Playwright'}\n\nEnvironment: ${execution.info.testEnvironments?.[0] || this.config.getConfig().environment}\nVersion: ${execution.info.version || this.config.getConfig().version}\nUser: ${execution.info.user || this.config.getConfig().jiraUsername}`,
          issuetype: {
            name: 'Task'
          },
          priority: {
            name: 'Medium'
          },
          assignee: {
            name: this.config.getConfig().jiraUsername
          }
        }
      });

      const testExecutionKey = response.data.key;
      this.logger.info(`Created test execution: ${testExecutionKey}`);
      
      // Add tests to the execution
      if (execution.tests.length > 0) {
        await this.addTestsToExecution(testExecutionKey, execution.tests);
      }

      return testExecutionKey;
    } catch (error) {
      this.logger.error(`Failed to create test execution: ${error}`);
      throw error;
    }
  }

  /**
   * Add test results to an existing test execution
   */
  public async addTestsToExecution(testExecutionKey: string, testResults: XrayTestResult[]): Promise<void> {
    try {
      // Use a more standard approach - add test results as a comment to the issue
      const testResultsComment = this.formatTestResultsComment(testResults);
      
      await this.axiosInstance.post(`/issue/${testExecutionKey}/comment`, {
        body: testResultsComment
      });

      this.logger.info(`Added ${testResults.length} test results to execution ${testExecutionKey}`);
    } catch (error) {
      this.logger.error(`Failed to add tests to execution ${testExecutionKey}: ${error}`);
      throw error;
    }
  }

  /**
   * Format test results as a readable comment
   */
  private formatTestResultsComment(testResults: XrayTestResult[]): string {
    let comment = `## 🧪 Test Execution Results\n\n`;
    comment += `**Execution Summary:**\n`;
    comment += `- Total Tests: ${testResults.length}\n`;
    
    const passedTests = testResults.filter(t => t.status === 'PASSED').length;
    const failedTests = testResults.filter(t => t.status === 'FAILED').length;
    const skippedTests = testResults.filter(t => t.status === 'SKIPPED').length;
    
    comment += `- Passed: ${passedTests}\n`;
    comment += `- Failed: ${failedTests}\n`;
    comment += `- Skipped: ${skippedTests}\n\n`;
    
    comment += `**Test Details:**\n`;
    testResults.forEach(test => {
      const statusIcon = test.status === 'PASSED' ? '✅' : test.status === 'FAILED' ? '❌' : '⏭️';
      comment += `${statusIcon} **${test.testKey}**: ${test.comment || 'Test executed'}\n`;
      if (test.executionTime) {
        comment += `  - Duration: ${test.executionTime}ms\n`;
      }
    });
    
    return comment;
  }

  /**
   * Update test execution status
   */
  public async updateTestExecutionStatus(testExecutionKey: string, status: 'PASSED' | 'FAILED' | 'IN_PROGRESS'): Promise<void> {
    try {
      // Try to update status using a more compatible approach
      const statusComment = `## 📊 Test Execution Status Updated\n\n**Final Status**: ${status}\n**Updated At**: ${new Date().toISOString()}`;
      
      await this.axiosInstance.post(`/issue/${testExecutionKey}/comment`, {
        body: statusComment
      });

      this.logger.info(`Updated test execution ${testExecutionKey} status to ${status} via comment`);
    } catch (error) {
      // If status update fails, just log it but don't fail the whole process
      this.logger.warn(`Could not update test execution status for ${testExecutionKey}: ${error}`);
      this.logger.info(`Test execution ${testExecutionKey} completed successfully without status update`);
    }
  }
}
