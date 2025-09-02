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

export class XrayServerClient {
  private static instance: XrayServerClient;
  private axiosInstance: AxiosInstance;
  private config: XrayConfigManager;
  private logger: Logger;

  private constructor() {
    this.config = XrayConfigManager.getInstance();
    this.logger = Logger.getInstance();
    
    // Use Jira REST API v2 for Xray Server (Jira plugin)
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
        this.logger.info(`Xray Server API call successful: ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error(`Xray Server API call failed: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.message}`);
        if (error.response) {
          this.logger.error(`Response status: ${error.response.status}`);
          this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): XrayServerClient {
    if (!XrayServerClient.instance) {
      XrayServerClient.instance = new XrayServerClient();
    }
    return XrayServerClient.instance;
  }

  /**
   * Find existing test case by key using Jira REST API
   */
  public async findTestCase(testKey: string): Promise<any> {
    try {
      this.logger.info(`Searching for test case in Xray Server: ${testKey}`);
      
      // Use Jira REST API to find the issue
      const response: AxiosResponse = await this.axiosInstance.get(`/issue/${testKey}`);
      
      if (response.data && response.data.fields.issuetype.name === 'Test') {
        this.logger.info(`Found existing test case in Xray Server: ${testKey}`);
        return response.data;
      } else {
        this.logger.info(`Issue ${testKey} exists but is not a Test type: ${response.data.fields.issuetype.name}`);
        return null;
      }
    } catch (error) {
      this.logger.info(`Test case ${testKey} not found in Xray Server - will create it`);
      return null;
    }
  }

  /**
   * Create test case in Xray Server (Jira plugin)
   */
  public async createTestCase(testKey: string, testTitle: string, testDescription?: string): Promise<string | null> {
    try {
      this.logger.info(`Creating test case in Xray Server: ${testKey}`);
      
      const testCaseData = {
        fields: {
          project: {
            key: this.config.getConfig().projectKey
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

      // Use Jira REST API to create the issue
      const response: AxiosResponse = await this.axiosInstance.post('/issue', testCaseData);
      
      if (response.data && response.data.key) {
        const createdTestKey = response.data.key;
        this.logger.info(`Successfully created test case in Xray Server: ${createdTestKey}`);
        return createdTestKey;
      } else {
        this.logger.warn(`Test case creation response missing key: ${JSON.stringify(response.data)}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Failed to create test case ${testKey} in Xray Server: ${error}`);
      return null;
    }
  }

  /**
   * Ensure test case exists (find or create)
   */
  public async ensureTestCaseExists(testKey: string, testTitle: string, testDescription?: string): Promise<string | null> {
    let testCase = await this.findTestCase(testKey);
    
    if (!testCase) {
      // Create the test case in Xray Server
      this.logger.info(`Creating test case ${testKey} in Xray Server Test Repository`);
      const createdKey = await this.createTestCase(testKey, testTitle, testDescription);
      if (createdKey) {
        testCase = { key: createdKey };
      } else {
        this.logger.warn(`Test case ${testKey} not found and could not be created in Xray Server`);
        return null;
      }
    }
    
    return testCase.key;
  }

  /**
   * Update test case status in Xray Server
   */
  public async updateTestCaseStatus(testKey: string, status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'TODO' | 'EXECUTING'): Promise<boolean> {
    try {
      const testCase = await this.findTestCase(testKey);
      if (!testCase) {
        this.logger.warn(`Cannot update status - test case not found in Xray Server: ${testKey}`);
        return false;
      }

      // Map Xray status to Jira status
      const jiraStatus = this.mapXrayStatusToJira(status);
      
      // Update test case status using Jira REST API
      await this.axiosInstance.put(`/issue/${testKey}`, {
        fields: {
          status: {
            name: jiraStatus
          }
        }
      });

      this.logger.info(`Updated test case ${testKey} status to ${status} (Jira: ${jiraStatus}) in Xray Server`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update test case ${testKey} status in Xray Server: ${error}`);
      return false;
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
   * Update all test case statuses
   */
  public async updateAllTestCaseStatuses(testResults: XrayTestResult[]): Promise<void> {
    let successCount = 0;
    for (const test of testResults) {
      const success = await this.updateTestCaseStatus(test.testKey, test.status);
      if (success) successCount++;
    }
    this.logger.info(`Updated statuses for ${successCount}/${testResults.length} test cases in Xray Server`);
  }

  /**
   * Add comment to test case in Xray Server
   */
  public async addTestExecutionComment(testKey: string, status: string, executionTime: number, comment?: string): Promise<boolean> {
    try {
      const testCase = await this.findTestCase(testKey);
      if (!testCase) {
        this.logger.warn(`Cannot add comment - test case not found in Xray Server: ${testKey}`);
        return false;
      }

      // Add comment using Jira REST API
      const executionComment = {
        body: `## 🧪 Test Execution Result\n\n**Status**: ${status}\n**Execution Time**: ${executionTime}ms\n**Timestamp**: ${new Date().toISOString()}\n\n${comment || 'Test executed via Playwright automation'}`
      };

      await this.axiosInstance.post(`/issue/${testKey}/comment`, executionComment);
      this.logger.info(`Added execution comment to test case ${testKey} in Xray Server`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to add comment to test case ${testKey} in Xray Server: ${error}`);
      return false;
    }
  }

  /**
   * Create test execution in Xray Server
   */
  public async createTestExecution(execution: Omit<XrayTestExecution, 'testExecutionKey'>): Promise<string | null> {
    try {
      // Ensure all test cases exist in Xray Server
      const existingTestCases = [];
      for (const test of execution.tests) {
        const testTitle = test.comment?.split('\n')[0] || `Test ${test.testKey}`;
        const testDescription = test.comment || `Automated test case for ${test.testKey}`;
        
        const testCaseKey = await this.ensureTestCaseExists(test.testKey, testTitle, testDescription);
        if (testCaseKey) {
          existingTestCases.push({ ...test, testCaseId: testCaseKey });
        } else {
          this.logger.warn(`Test case ${test.testKey} not found and could not be created in Xray Server`);
        }
      }

      if (existingTestCases.length === 0) {
        this.logger.warn('No test cases could be created in Xray Server for execution');
        return null;
      }

      // Create test execution using Jira REST API
      const executionData = {
        fields: {
          project: {
            key: this.config.getConfig().projectKey
          },
          summary: execution.info.summary,
          description: execution.info.description || 'Automated test execution from Playwright',
          issuetype: {
            name: 'Test Execution'
          },
          priority: {
            name: 'Medium'
          },
          assignee: {
            name: this.config.getConfig().jiraUsername
          }
        }
      };

      // Create the test execution issue
      const response: AxiosResponse = await this.axiosInstance.post('/issue', executionData);
      
      if (response.data && response.data.key) {
        const testExecutionKey = response.data.key;
        this.logger.info(`Created test execution in Xray Server: ${testExecutionKey}`);
        
        // Add test results as comments or custom fields
        for (const test of existingTestCases) {
          await this.addTestExecutionComment(test.testKey, test.status, test.executionTime, test.comment);
        }
        
        return testExecutionKey;
      } else {
        this.logger.warn(`Test execution creation response missing key: ${JSON.stringify(response.data)}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Failed to create test execution in Xray Server: ${error}`);
      return null;
    }
  }
}
