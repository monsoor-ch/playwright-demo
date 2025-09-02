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

export interface XrayCloudTestCase {
  key?: string;
  name: string;
  projectKey: string;
  type: 'Generic' | 'Cucumber' | 'Manual';
  definition?: string;
  precondition?: string;
  labels?: string[];
  components?: string[];
  priority?: 'High' | 'Medium' | 'Low';
  assignee?: string;
  tags?: string[];
}

export class XrayCloudClientAuth {
  private static instance: XrayCloudClientAuth;
  private axiosInstance: AxiosInstance;
  private config: XrayConfigManager;
  private logger: Logger;
  private xrayCloudUrl: string = 'https://xray.cloud.getxray.app';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private constructor() {
    this.config = XrayConfigManager.getInstance();
    this.logger = Logger.getInstance();
    
    // Create axios instance for Xray Cloud
    this.axiosInstance = axios.create({
      baseURL: this.xrayCloudUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Add response interceptor for detailed logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.info(`Xray Cloud API call successful: ${response.config.method?.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error(`Xray Cloud API call failed: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.message}`);
        if (error.response) {
          this.logger.error(`Response status: ${error.response.status}`);
          this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
        }
        return Promise.reject(error);
      }
    );
  }

  public static getInstance(): XrayCloudClientAuth {
    if (!XrayCloudClientAuth.instance) {
      XrayCloudClientAuth.instance = new XrayCloudClientAuth();
    }
    return XrayCloudClientAuth.instance;
  }

  /**
   * Authenticate with Xray Cloud and get access token
   */
  private async authenticate(): Promise<string> {
    try {
      // Check if we have a valid token
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        this.logger.info('Using existing valid access token');
        return this.accessToken;
      }

      this.logger.info('Authenticating with Xray Cloud...');
      
      // Xray Cloud authentication endpoint
      const authResponse: AxiosResponse = await this.axiosInstance.post('/api/v2/authenticate', {
        client_id: this.config.getConfig().jiraUsername,
        client_secret: this.config.getConfig().jiraApiToken
      });

      if (authResponse.data && authResponse.data.access_token) {
        this.accessToken = authResponse.data.access_token;
        // Set token expiry (usually 1 hour, but set to 50 minutes to be safe)
        this.tokenExpiry = Date.now() + (50 * 60 * 1000);
        
        this.logger.info('Successfully authenticated with Xray Cloud');
        return this.accessToken;
      } else {
        throw new Error('Authentication response missing access_token');
      }
    } catch (error) {
      this.logger.error(`Failed to authenticate with Xray Cloud: ${error}`);
      throw error;
    }
  }

  /**
   * Get authenticated axios instance with current access token
   */
  private async getAuthenticatedInstance(): Promise<AxiosInstance> {
    const token = await this.authenticate();
    
    // Create new instance with current token
    const authenticatedInstance = axios.create({
      baseURL: this.xrayCloudUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    return authenticatedInstance;
  }

  /**
   * Find existing test case by key using Xray Cloud API
   */
  public async findTestCase(testKey: string): Promise<any> {
    try {
      this.logger.info(`Searching for test case in Xray Cloud: ${testKey}`);
      
      const authenticatedInstance = await this.getAuthenticatedInstance();
      
      // Xray Cloud API endpoint for getting test case
      const response: AxiosResponse = await authenticatedInstance.get(`/api/v2/test/${testKey}`);
      
      if (response.data) {
        this.logger.info(`Found existing test case in Xray Cloud: ${testKey}`);
        return response.data;
      } else {
        this.logger.info(`Test case not found in Xray Cloud: ${testKey}`);
        return null;
      }
    } catch (error) {
      this.logger.info(`Test case ${testKey} not found in Xray Cloud - will import it`);
      return null;
    }
  }

  /**
   * Import test case to Xray Cloud if it doesn't exist
   */
  public async importTestCase(testKey: string, testTitle: string, testDescription?: string): Promise<string | null> {
    try {
      this.logger.info(`Importing test case to Xray Cloud: ${testKey}`);
      
      const authenticatedInstance = await this.getAuthenticatedInstance();
      
      const testCaseData: XrayCloudTestCase = {
        key: testKey,
        name: testTitle,
        projectKey: this.config.getConfig().projectKey,
        type: 'Generic',
        definition: testDescription || `Automated test case imported by Playwright integration\n\nTest Key: ${testKey}\nImported: ${new Date().toISOString()}`,
        priority: 'Medium',
        assignee: this.config.getConfig().jiraUsername,
        labels: ['playwright', 'automation'],
        tags: ['automated', 'playwright']
      };

      // Xray Cloud import endpoint
      const response: AxiosResponse = await authenticatedInstance.post('/api/v2/import/test', testCaseData);
      
      if (response.data && response.data.key) {
        const importedTestKey = response.data.key;
        this.logger.info(`Successfully imported test case to Xray Cloud: ${importedTestKey}`);
        return importedTestKey;
      } else {
        this.logger.warn(`Test case import response missing key: ${JSON.stringify(response.data)}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Failed to import test case ${testKey} to Xray Cloud: ${error}`);
      return null;
    }
  }

  /**
   * Ensure test case exists (find or import)
   */
  public async ensureTestCaseExists(testKey: string, testTitle: string, testDescription?: string): Promise<string | null> {
    let testCase = await this.findTestCase(testKey);
    
    if (!testCase) {
      // Import the test case to Xray Cloud
      this.logger.info(`Importing test case ${testKey} to Xray Cloud Test Repository`);
      const importedKey = await this.importTestCase(testKey, testTitle, testDescription);
      if (importedKey) {
        testCase = { key: importedKey };
      } else {
        this.logger.warn(`Test case ${testKey} not found and could not be imported to Xray Cloud`);
        return null;
      }
    }
    
    return testCase.key;
  }

  /**
   * Update test case status in Xray Cloud
   */
  public async updateTestCaseStatus(testKey: string, status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'TODO' | 'EXECUTING'): Promise<boolean> {
    try {
      const testCase = await this.findTestCase(testKey);
      if (!testCase) {
        this.logger.warn(`Cannot update status - test case not found in Xray Cloud: ${testKey}`);
        return false;
      }

      const authenticatedInstance = await this.getAuthenticatedInstance();
      
      // Update test case status using Xray Cloud API
      await authenticatedInstance.put(`/api/v2/test/${testKey}`, {
        status: status
      });

      this.logger.info(`Updated test case ${testKey} status to ${status} in Xray Cloud`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update test case ${testKey} status in Xray Cloud: ${error}`);
      return false;
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
    this.logger.info(`Updated statuses for ${successCount}/${testResults.length} test cases in Xray Cloud`);
  }

  /**
   * Create test execution in Xray Cloud
   */
  public async createTestExecution(execution: Omit<XrayTestExecution, 'testExecutionKey'>): Promise<string | null> {
    try {
      // Ensure all test cases exist in Xray Cloud
      const existingTestCases = [];
      for (const test of execution.tests) {
        const testTitle = test.comment?.split('\n')[0] || `Test ${test.testKey}`;
        const testDescription = test.comment || `Automated test case for ${test.testKey}`;
        
        const testCaseKey = await this.ensureTestCaseExists(test.testKey, testTitle, testDescription);
        if (testCaseKey) {
          existingTestCases.push({ ...test, testCaseId: testCaseKey });
        } else {
          this.logger.warn(`Test case ${test.testKey} not found and could not be imported to Xray Cloud`);
        }
      }

      if (existingTestCases.length === 0) {
        this.logger.warn('No test cases could be imported to Xray Cloud for execution');
        return null;
      }

      const authenticatedInstance = await this.getAuthenticatedInstance();
      
      // Create test execution using Xray Cloud API
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

      // Xray Cloud test execution endpoint
      const response: AxiosResponse = await authenticatedInstance.post('/api/v2/import/execution', executionData);
      
      const testExecutionKey = response.data.key || response.data.testExecutionKey;
      this.logger.info(`Created test execution in Xray Cloud: ${testExecutionKey}`);
      
      return testExecutionKey;
    } catch (error) {
      this.logger.error(`Failed to create test execution in Xray Cloud: ${error}`);
      return null;
    }
  }

  /**
   * Add comment to test case in Xray Cloud
   */
  public async addTestExecutionComment(testKey: string, status: string, executionTime: number, comment?: string): Promise<boolean> {
    try {
      const testCase = await this.findTestCase(testKey);
      if (!testCase) {
        this.logger.warn(`Cannot add comment - test case not found in Xray Cloud: ${testKey}`);
        return false;
      }

      const authenticatedInstance = await this.getAuthenticatedInstance();
      
      // Xray Cloud comment endpoint
      const executionComment = {
        body: `## 🧪 Test Execution Result\n\n**Status**: ${status}\n**Execution Time**: ${executionTime}ms\n**Timestamp**: ${new Date().toISOString()}\n\n${comment || 'Test executed via Playwright automation'}`
      };

      await authenticatedInstance.post(`/api/v2/test/${testKey}/comment`, executionComment);
      this.logger.info(`Added execution comment to test case ${testKey} in Xray Cloud`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to add comment to test case ${testKey} in Xray Cloud: ${error}`);
      return false;
    }
  }
}
