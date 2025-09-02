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
   * Find test case by matching Playwright test description with Xray summary
   */
  public async findTestCaseByDescription(testDescription: string): Promise<any> {
    try {
      this.logger.info(`Searching for test case by description in Xray Server: ${testDescription.substring(0, 50)}...`);
      
      // Search for test cases in the project with matching summary
      const jql = `project = ${this.config.getConfig().projectKey} AND issuetype = "Test" AND summary ~ "${testDescription.replace(/"/g, '\\"')}"`;
      
      const response: AxiosResponse = await this.axiosInstance.post('/search', {
        jql: jql,
        maxResults: 10,
        fields: ['key', 'summary', 'description', 'status', 'issuetype']
      });
      
      if (response.data.issues && response.data.issues.length > 0) {
        // Find the best match (exact or closest)
        const bestMatch = response.data.issues.find((issue: any) => 
          issue.fields.summary.toLowerCase().trim() === testDescription.toLowerCase().trim()
        ) || response.data.issues[0];
        
        this.logger.info(`Found matching test case by description: ${bestMatch.key} - ${bestMatch.fields.summary}`);
        return bestMatch;
      } else {
        this.logger.info(`No test case found matching description: ${testDescription}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Failed to search test case by description: ${error}`);
      return null;
    }
  }

  /**
   * Update test case summary if it differs from Playwright description
   */
  public async updateTestCaseSummary(testKey: string, newSummary: string): Promise<boolean> {
    try {
      const testCase = await this.findTestCase(testKey);
      if (!testCase) {
        this.logger.warn(`Cannot update summary - test case not found: ${testKey}`);
        return false;
      }

      const currentSummary = testCase.fields.summary;
      if (currentSummary === newSummary) {
        this.logger.info(`Test case ${testKey} summary is already up to date`);
        return true;
      }

      // Update the summary
      await this.axiosInstance.put(`/issue/${testKey}`, {
        fields: {
          summary: newSummary
        }
      });

      this.logger.info(`Updated test case ${testKey} summary from "${currentSummary}" to "${newSummary}"`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update test case ${testKey} summary: ${error}`);
      return false;
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
   * Ensure test case exists (find by key, find by description, or create)
   */
  public async ensureTestCaseExists(testKey: string, testTitle: string, testDescription?: string): Promise<string | null> {
    let testCase = await this.findTestCase(testKey);
    
    if (!testCase) {
      // Try to find by description matching
      this.logger.info(`Test case ${testKey} not found by key, searching by description...`);
      testCase = await this.findTestCaseByDescription(testTitle);
      
      if (testCase) {
        this.logger.info(`Found test case by description: ${testCase.key} - will update summary if needed`);
        // Update summary if it differs from Playwright test title
        await this.updateTestCaseSummary(testCase.key, testTitle);
        return testCase.key;
      }
    }
    
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
    } else {
      // Update summary if it differs from Playwright test title
      await this.updateTestCaseSummary(testCase.key, testTitle);
    }
    
    return testCase.key;
  }

  /**
   * Update test case status in Xray Server using proper Xray workflow
   */
  public async updateTestCaseStatus(testKey: string, status: 'PASSED' | 'FAILED' | 'SKIPPED' | 'TODO' | 'EXECUTING', executionTime?: number): Promise<boolean> {
    try {
      const testCase = await this.findTestCase(testKey);
      if (!testCase) {
        this.logger.warn(`Cannot update status - test case not found in Xray Server: ${testKey}`);
        return false;
      }

      // Step 1: Ensure Test Execution exists (create or find existing)
      const testExecutionKey = await this.ensureTestExecutionExists();
      if (!testExecutionKey) {
        this.logger.error(`Failed to create or find test execution for ${testKey}`);
        return false;
      }

      // Step 2: Add test case to Test Execution (create Test Run)
      const testRunKey = await this.addTestCaseToExecution(testExecutionKey, testKey, status, executionTime);
      if (!testRunKey) {
        this.logger.error(`Failed to add test case ${testKey} to execution ${testExecutionKey}`);
        return false;
      }

      // Step 3: Integration complete - Test Run created with status in summary
      // Xray will handle the status management through its workflow
      this.logger.info(`Successfully created test run ${testRunKey} with status ${status} for test case ${testKey} in execution ${testExecutionKey}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update test case ${testKey} status in Xray Server: ${error}`);
      return false;
    }
  }

  /**
   * Ensure Test Execution exists (create or find existing)
   */
  private async ensureTestExecutionExists(): Promise<string | null> {
    try {
      // Try to find existing Test Execution for today
      const today = new Date().toISOString().split('T')[0];
      const jql = `project = ${this.config.getConfig().projectKey} AND issuetype = "Test Execution" AND summary ~ "Playwright Test Execution ${today}" ORDER BY created DESC`;
      
      const searchResponse = await this.axiosInstance.post('/search', {
        jql: jql,
        maxResults: 1,
        fields: ['key', 'summary', 'created']
      });
      
      if (searchResponse.data.issues && searchResponse.data.issues.length > 0) {
        const existingExecution = searchResponse.data.issues[0];
        this.logger.info(`Found existing test execution: ${existingExecution.key}`);
        return existingExecution.key;
      }
      
      // Create new Test Execution
      const executionData = {
        fields: {
          project: {
            key: this.config.getConfig().projectKey
          },
          summary: `Playwright Test Execution ${today}`,
          description: `Automated test execution from Playwright\n\nCreated: ${new Date().toISOString()}\nEnvironment: CI/CD`,
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
      
      const response = await this.axiosInstance.post('/issue', executionData);
      if (response.data && response.data.key) {
        this.logger.info(`Created new test execution: ${response.data.key}`);
        return response.data.key;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Failed to ensure test execution exists: ${error}`);
      return null;
    }
  }

  /**
   * Add test case to Test Execution (create test run)
   */
  private async addTestCaseToExecution(testExecutionKey: string, testKey: string, status: string, executionTime?: number): Promise<string | null> {
    try {
      // Create Sub Test Execution (Test Run) linked to the main Test Execution
      const testRunData = {
        fields: {
          project: {
            key: this.config.getConfig().projectKey
          },
          summary: `Test Run: ${testKey} - ${status}`,
          description: `Test run for ${testKey}\n\nStatus: ${status}\nExecution Time: ${executionTime || 0}ms\nTimestamp: ${new Date().toISOString()}`,
          issuetype: {
            name: 'Sub Test Execution'
          },
          priority: {
            name: 'Medium'
          },
          assignee: {
            name: this.config.getConfig().jiraUsername
          },
          parent: {
            key: testExecutionKey
          }
        }
      };
      
      const response = await this.axiosInstance.post('/issue', testRunData);
      if (response.data && response.data.key) {
        this.logger.info(`Created test run ${response.data.key} for test case ${testKey} in execution ${testExecutionKey}`);
        return response.data.key;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Failed to add test case to execution: ${error}`);
      return null;
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
      const success = await this.updateTestCaseStatus(test.testKey, test.status, test.executionTime);
      if (success) successCount++;
    }
    this.logger.info(`Updated statuses for ${successCount}/${testResults.length} test cases in Xray Server`);
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
        this.logger.warn('No test cases could be created in Xray Server for test execution');
        return null;
      }

      // Create test execution using Jira REST API
      const testExecutionData = {
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
      const response: AxiosResponse = await this.axiosInstance.post('/issue', testExecutionData);
      
      if (response.data && response.data.key) {
        const testExecutionKey = response.data.key;
        this.logger.info(`Created test execution in Xray Server: ${testExecutionKey}`);
        
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
