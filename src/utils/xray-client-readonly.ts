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

export class XrayClientReadOnly {
  private static instance: XrayClientReadOnly;
  private axiosInstance: AxiosInstance;
  private config: XrayConfigManager;
  private logger: Logger;

  private constructor() {
    this.config = XrayConfigManager.getInstance();
    this.logger = Logger.getInstance();
    
    // Use Jira API v2 for better compatibility
    this.axiosInstance = axios.create({
      baseURL: this.config.getJiraApiUrlV2(),
      auth: {
        username: this.config.getConfig().jiraUsername,
        password: this.config.getConfig().jiraApiToken
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add response interceptor for detailed logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.info(`Xray API call successful: ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error(`Xray API call failed: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.message}`);
        if (error.response) {
          this.logger.error(`Response status: ${error.response.status}`);
          this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): XrayClientReadOnly {
    if (!XrayClientReadOnly.instance) {
      XrayClientReadOnly.instance = new XrayClientReadOnly();
    }
    return XrayClientReadOnly.instance;
  }

  /**
   * Find existing test case by key (e.g., XSP-58) - Read-only operation
   */
  public async findTestCase(testKey: string): Promise<any> {
    try {
      this.logger.info(`Searching for test case: ${testKey}`);
      
      // Direct issue lookup - simpler and more reliable
      const response: AxiosResponse = await this.axiosInstance.get(`/issue/${testKey}`);
      
      if (response.data) {
        this.logger.info(`Found existing test case: ${testKey} (Type: ${response.data.fields.issuetype.name})`);
        return response.data;
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
   * Create test execution using Xray API - Read-only mode
   */
  public async createTestExecution(execution: Omit<XrayTestExecution, 'testExecutionKey'>): Promise<string> {
    try {
      // Verify all test cases exist (read-only check)
      const existingTestCases = [];
      for (const test of execution.tests) {
        const testCase = await this.findTestCase(test.testKey);
        if (testCase) {
          existingTestCases.push({ ...test, testCaseId: testCase.id });
          this.logger.info(`Test case ${test.testKey} exists and is ready for execution`);
        } else {
          this.logger.warn(`Test case ${test.testKey} not found - skipping`);
        }
      }

      if (existingTestCases.length === 0) {
        throw new Error('No existing test cases found to execute');
      }

      // Try to create test execution using Xray API
      const executionData = {
        testExecutionKey: null,
        info: {
          summary: execution.info.summary,
          description: execution.info.description || 'Automated test execution from Playwright (Read-only mode)',
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

  /**
   * Log test results without modifying test cases
   */
  public async logTestResults(testResults: XrayTestResult[]): Promise<void> {
    this.logger.info(`=== Test Execution Summary ===`);
    this.logger.info(`Total Tests: ${testResults.length}`);
    
    for (const test of testResults) {
      const testCase = await this.findTestCase(test.testKey);
      if (testCase) {
        this.logger.info(`✅ ${test.testKey}: ${test.status} - ${testCase.fields.summary}`);
      } else {
        this.logger.warn(`❌ ${test.testKey}: ${test.status} - Test case not found`);
      }
    }
    
    this.logger.info(`=== End Test Execution Summary ===`);
  }
}
