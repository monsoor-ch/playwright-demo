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

  public static getInstance(): XrayClient {
    if (!XrayClient.instance) {
      XrayClient.instance = new XrayClient();
    }
    return XrayClient.instance;
  }

  /**
   * Find existing test case by key (e.g., XSP-58) in Xray Test Repository
   */
  public async findTestCase(testKey: string): Promise<any> {
    try {
      this.logger.info(`Searching for test case: ${testKey}`);
      
      // Search for test case in Xray Test Repository - use simpler JQL
      const jql = `key = ${testKey}`;
      const response: AxiosResponse = await this.axiosInstance.post('/search', {
        jql: jql,
        fields: ['key', 'summary', 'status', 'id', 'description', 'issuetype']
      });

      if (response.data.issues && response.data.issues.length > 0) {
        this.logger.info(`Found existing test case: ${testKey} (Type: ${response.data.issues[0].fields.issuetype.name})`);
        return response.data.issues[0];
      } else {
        this.logger.info(`Test case not found: ${testKey} - will create it`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Failed to find test case ${testKey}: ${error}`);
      return null;
    }
  }

  /**
   * Create test case in Xray Test Repository if it doesn't exist
   */
  public async createTestCase(testKey: string, testTitle: string, testDescription?: string): Promise<string> {
    try {
      this.logger.info(`Creating test case: ${testKey}`);
      
      // Use configured project key and 'Test' issue type for XSP project
      const testCaseData = {
        fields: {
          project: {
            key: this.config.getConfig().projectKey
          },
          summary: testTitle,
          description: testDescription || `Automated test case created by Playwright integration`,
          issuetype: {
            name: 'Test'  // Use 'Test' for XSP project
          },
          priority: {
            name: 'Medium'
          },
          assignee: {
            name: this.config.getConfig().jiraUsername
          }
        }
      };

      const response: AxiosResponse = await this.axiosInstance.post('/issue', testCaseData);
      const createdTestKey = response.data.key;
      
      this.logger.info(`Successfully created new test case: ${createdTestKey}`);
      return createdTestKey;
    } catch (error) {
      this.logger.error(`Failed to create test case ${testKey}: ${error}`);
      throw error;
    }
  }

  /**
   * Ensure test case exists (find or create)
   */
  public async ensureTestCaseExists(testKey: string, testTitle: string, testDescription?: string): Promise<string> {
    let testCase = await this.findTestCase(testKey);
    
    if (!testCase) {
      // Create the test case if it doesn't exist
      this.logger.info(`Creating test case ${testKey} in Xray Test Repository`);
      const createdKey = await this.createTestCase(testKey, testTitle, testDescription);
      testCase = { key: createdKey };
    }
    
    return testCase.key;
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
   * Create test execution using Xray API with automatic test case creation
   */
  public async createTestExecution(execution: Omit<XrayTestExecution, 'testExecutionKey'>): Promise<string> {
    try {
      // Ensure all test cases exist in Xray Test Repository
      const existingTestCases = [];
      for (const test of execution.tests) {
        // Extract test title from comment or use test key as fallback
        const testTitle = test.comment?.replace(/^Test: /, '') || `Test ${test.testKey}`;
        const testDescription = `Automated test case for ${test.testKey}`;
        
        const testCaseKey = await this.ensureTestCaseExists(test.testKey, testTitle, testDescription);
        existingTestCases.push({ ...test, testCaseId: testCaseKey });
      }

      if (existingTestCases.length === 0) {
        throw new Error('No test cases could be created or found in Xray Test Repository');
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
