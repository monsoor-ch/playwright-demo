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

export class XrayClientFull {
  private static instance: XrayClientFull;
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

  public static getInstance(): XrayClientFull {
    if (!XrayClientFull.instance) {
      XrayClientFull.instance = new XrayClientFull();
    }
    return XrayClientFull.instance;
  }

  /**
   * Find existing test case by key (e.g., XSP-100)
   */
  public async findTestCase(testKey: string): Promise<any> {
    try {
      this.logger.info(`Searching for test case: ${testKey}`);
      
      // Direct issue lookup - most reliable method
      const response: AxiosResponse = await this.axiosInstance.get(`/issue/${testKey}`);
      
      if (response.data) {
        this.logger.info(`Found existing test case: ${testKey} (Type: ${response.data.fields.issuetype.name})`);
        return response.data;
      } else {
        this.logger.info(`Test case not found: ${testKey} - will create it`);
        return null;
      }
    } catch (error) {
      this.logger.info(`Test case ${testKey} not found - will create it`);
      return null;
    }
  }

  /**
   * Create test case automatically if it doesn't exist
   */
  public async createTestCase(testKey: string, testTitle: string, testDescription?: string): Promise<string> {
    try {
      this.logger.info(`Creating test case: ${testKey}`);
      
      // Extract project key from test key (e.g., XSP-100 -> XSP)
      const projectKey = testKey.split('-')[0];
      
      const testCaseData = {
        fields: {
          project: {
            key: projectKey
          },
          summary: testTitle,
          description: testDescription || `Automated test case created by Playwright integration\n\nTest Key: ${testKey}\nCreated: ${new Date().toISOString()}`,
          issuetype: {
            name: 'Test'
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
   * Update test case status directly
   */
  public async updateTestCaseStatus(testKey: string, status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'TODO' | 'EXECUTING'): Promise<void> {
    try {
      const testCase = await this.findTestCase(testKey);
      if (!testCase) {
        this.logger.warn(`Cannot update status - test case not found: ${testKey}`);
        return;
      }

      // Map Xray status to Jira status
      const jiraStatus = this.mapXrayStatusToJira(status);
      
      // Update test case status using Jira API
      await this.axiosInstance.put(`/issue/${testKey}`, {
        fields: {
          status: {
            name: jiraStatus
          }
        }
      });

      this.logger.info(`Updated test case ${testKey} status to ${status} (Jira: ${jiraStatus})`);
    } catch (error) {
      this.logger.error(`Failed to update test case ${testKey} status: ${error}`);
      // Don't throw error - continue with other updates
    }
  }

  /**
   * Map Xray status to Jira status
   */
  private mapXrayStatusToJira(xrayStatus: string): string {
    switch (xrayStatus) {
      case 'PASSED':
        return 'Done';
      case 'FAILED':
        return 'In Progress';
      case 'SKIPPED':
        return 'To Do';
      case 'TODO':
        return 'To Do';
      case 'EXECUTING':
        return 'In Progress';
      default:
        return 'To Do';
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
        const testTitle = test.comment?.split('\n')[0] || `Test ${test.testKey}`;
        const testDescription = test.comment || `Automated test case for ${test.testKey}`;
        
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

  /**
   * Add comment to test case with execution details
   */
  public async addTestExecutionComment(testKey: string, status: string, executionTime: number, comment?: string): Promise<void> {
    try {
      const executionComment = {
        body: `## 🧪 Test Execution Result\n\n**Status**: ${status}\n**Execution Time**: ${executionTime}ms\n**Timestamp**: ${new Date().toISOString()}\n\n${comment || 'Test executed via Playwright automation'}`
      };

      await this.axiosInstance.post(`/issue/${testKey}/comment`, executionComment);
      this.logger.info(`Added execution comment to test case ${testKey}`);
    } catch (error) {
      this.logger.error(`Failed to add comment to test case ${testKey}: ${error}`);
    }
  }
}
