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
   * Find existing test case by key (e.g., PROJ-001)
   */
  public async findTestCase(testKey: string): Promise<any> {
    try {
      const jql = `key = ${testKey} AND issuetype = "Test"`;
      const response: AxiosResponse = await this.axiosInstance.post('/search', {
        jql: jql,
        fields: ['key', 'summary', 'status', 'id']
      });

      if (response.data.issues && response.data.issues.length > 0) {
        this.logger.info(`Found existing test case: ${testKey}`);
        return response.data.issues[0];
      } else {
        this.logger.warn(`Test case not found: ${testKey}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Failed to find test case ${testKey}: ${error}`);
      return null;
    }
  }

  /**
   * Update test case status directly (for existing test cases)
   */
  public async updateTestCaseStatus(testKey: string, status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'TODO' | 'EXECUTING'): Promise<void> {
    try {
      const testCase = await this.findTestCase(testKey);
      if (!testCase) {
        this.logger.warn(`Cannot update status - test case not found: ${testKey}`);
        return;
      }

      // Update test case status using Xray API
      await this.axiosInstance.put(`/testcase/${testKey}/status`, {
        status: status
      });

      this.logger.info(`Updated test case ${testKey} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update test case ${testKey} status: ${error}`);
      // Don't throw error - continue with other updates
    }
  }

  /**
   * Update all test case statuses in the execution
   */
  public async updateAllTestCaseStatuses(testResults: XrayTestResult[]): Promise<void> {
    for (const test of testResults) {
      await this.updateTestCaseStatus(test.testKey, test.status);
    }
    this.logger.info(`Updated statuses for ${testResults.length} test cases`);
  }

  /**
   * Create test execution using Xray API (only if needed)
   */
  public async createTestExecution(execution: Omit<XrayTestExecution, 'testExecutionKey'>): Promise<string> {
    try {
      // First, verify all test cases exist
      const existingTestCases = [];
      for (const test of execution.tests) {
        const testCase = await this.findTestCase(test.testKey);
        if (testCase) {
          existingTestCases.push({ ...test, testCaseId: testCase.id });
        } else {
          this.logger.warn(`Skipping test ${test.testKey} - test case not found in Jira`);
        }
      }

      if (existingTestCases.length === 0) {
        throw new Error('No existing test cases found to execute');
      }

      // Create test execution using Xray API
      const executionData = {
        testExecutionKey: null,
        info: {
          summary: execution.info.summary,
          description: execution.info.description || 'Automated test execution from Playwright',
          testEnvironments: execution.info.testEnvironments || [this.config.getConfig().environment],
          version: execution.info.version || this.config.getConfig().version,
          user: execution.info.user || this.config.getConfig().jiraUsername,
          startDate: execution.info.startDate || new Date().toISOString()
        },
        tests: existingTestCases.map(test => ({
          testKey: test.testKey,
          status: test.status,
          comment: test.comment || `Test executed via Playwright automation`,
          executionTime: test.executionTime || 0
        }))
      };

      // Use Xray REST API to create test execution
      const response: AxiosResponse = await this.axiosInstance.post('/testexecution', executionData);
      
      const testExecutionKey = response.data.key || response.data.testExecutionKey;
      this.logger.info(`Created test execution: ${testExecutionKey}`);
      
      return testExecutionKey;
    } catch (error) {
      this.logger.error(`Failed to create test execution: ${error}`);
      throw error;
    }
  }
}
