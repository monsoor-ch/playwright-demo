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

export class XrayClientHybrid {
  private static instance: XrayClientHybrid;
  private axiosInstance: AxiosInstance;
  private config: XrayConfigManager;
  private logger: Logger;
  private canCreateIssues: boolean = true;

  private constructor() {
    this.config = XrayConfigManager.getInstance();
    this.logger = Logger.getInstance();
    
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

  public static getInstance(): XrayClientHybrid {
    if (!XrayClientHybrid.instance) {
      XrayClientHybrid.instance = new XrayClientHybrid();
    }
    return XrayClientHybrid.instance;
  }

  /**
   * Find existing test case by key
   */
  public async findTestCase(testKey: string): Promise<any> {
    try {
      this.logger.info(`Searching for test case: ${testKey}`);
      
      const response: AxiosResponse = await this.axiosInstance.get(`/issue/${testKey}`);
      
      if (response.data) {
        this.logger.info(`Found existing test case: ${testKey} (Type: ${response.data.fields.issuetype.name})`);
        return response.data;
      } else {
        this.logger.info(`Test case not found: ${testKey}`);
        return null;
      }
    } catch (error) {
      this.logger.info(`Test case ${testKey} not found - will attempt to create it`);
      return null;
    }
  }

  /**
   * Try to create test case, but don't fail if we can't
   */
  public async tryCreateTestCase(testKey: string, testTitle: string, testDescription?: string): Promise<string | null> {
    if (!this.canCreateIssues) {
      this.logger.info(`Skipping test case creation for ${testKey} - creation disabled`);
      return null;
    }

    try {
      this.logger.info(`Attempting to create test case: ${testKey}`);
      
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
      this.logger.warn(`Failed to create test case ${testKey}: ${error}`);
      this.logger.info(`Disabling test case creation for future attempts`);
      this.canCreateIssues = false;
      return null;
    }
  }

  /**
   * Ensure test case exists (find or try to create)
   */
  public async ensureTestCaseExists(testKey: string, testTitle: string, testDescription?: string): Promise<string | null> {
    let testCase = await this.findTestCase(testKey);
    
    if (!testCase) {
      // Try to create the test case
      const createdKey = await this.tryCreateTestCase(testKey, testTitle, testDescription);
      if (createdKey) {
        testCase = { key: createdKey };
      } else {
        this.logger.warn(`Test case ${testKey} not found and could not be created`);
        return null;
      }
    }
    
    return testCase.key;
  }

  /**
   * Update test case status if it exists
   */
  public async updateTestCaseStatus(testKey: string, status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'TODO' | 'EXECUTING'): Promise<boolean> {
    try {
      const testCase = await this.findTestCase(testKey);
      if (!testCase) {
        this.logger.warn(`Cannot update status - test case not found: ${testKey}`);
        return false;
      }

      // Map Xray status to Jira status
      const jiraStatus = this.mapXrayStatusToJira(status);
      
      // Update test case status
      await this.axiosInstance.put(`/issue/${testKey}`, {
        fields: {
          status: {
            name: jiraStatus
          }
        }
      });

      this.logger.info(`Updated test case ${testKey} status to ${status} (Jira: ${jiraStatus})`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update test case ${testKey} status: ${error}`);
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
   * Update all test case statuses that exist
   */
  public async updateAllTestCaseStatuses(testResults: XrayTestResult[]): Promise<void> {
    let successCount = 0;
    for (const test of testResults) {
      const success = await this.updateTestCaseStatus(test.testKey, test.status);
      if (success) successCount++;
    }
    this.logger.info(`Updated statuses for ${successCount}/${testResults.length} test cases`);
  }

  /**
   * Add comment to test case if it exists
   */
  public async addTestExecutionComment(testKey: string, status: string, executionTime: number, comment?: string): Promise<boolean> {
    try {
      const testCase = await this.findTestCase(testKey);
      if (!testCase) {
        this.logger.warn(`Cannot add comment - test case not found: ${testKey}`);
        return false;
      }

      const executionComment = {
        body: `## 🧪 Test Execution Result\n\n**Status**: ${status}\n**Execution Time**: ${executionTime}ms\n**Timestamp**: ${new Date().toISOString()}\n\n${comment || 'Test executed via Playwright automation'}`
      };

      await this.axiosInstance.post(`/issue/${testKey}/comment`, executionComment);
      this.logger.info(`Added execution comment to test case ${testKey}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to add comment to test case ${testKey}: ${error}`);
      return false;
    }
  }

  /**
   * Create test execution with existing test cases
   */
  public async createTestExecution(execution: Omit<XrayTestExecution, 'testExecutionKey'>): Promise<string | null> {
    try {
      // Find existing test cases
      const existingTestCases = [];
      for (const test of execution.tests) {
        const testCase = await this.findTestCase(test.testKey);
        if (testCase) {
          existingTestCases.push({ ...test, testCaseId: testCase.key });
        } else {
          this.logger.warn(`Test case ${test.testKey} not found - skipping from execution`);
        }
      }

      if (existingTestCases.length === 0) {
        this.logger.warn('No existing test cases found for execution');
        return null;
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
      return null;
    }
  }
}
