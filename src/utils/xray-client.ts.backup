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
      const response: AxiosResponse = await this.axiosInstance.post('/issue', {
        fields: {
          project: {
            key: this.config.getConfig().projectKey
          },
          summary: execution.info.summary,
          description: execution.info.description || 'Automated test execution from Playwright',
          issuetype: {
            name: 'Test Execution'
          },
          customfield_10014: execution.info.testEnvironments || [this.config.getConfig().environment],
          customfield_10015: execution.info.version || this.config.getConfig().version,
          customfield_10016: execution.info.testPlanKey,
          customfield_10017: execution.info.revision || '1.0',
          customfield_10018: execution.info.user || this.config.getConfig().jiraUsername,
          customfield_10019: execution.info.startDate || new Date().toISOString(),
          customfield_10020: execution.info.finishDate || new Date().toISOString()
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
      const response: AxiosResponse = await this.axiosInstance.post(`/issue/${testExecutionKey}/attachments`, {
        testResults: testResults.map(test => ({
          testKey: test.testKey,
          status: test.status,
          comment: test.comment || '',
          evidence: test.evidence || [],
          executionTime: test.executionTime || 0,
          defects: test.defects || []
        }))
      });

      this.logger.info(`Added ${testResults.length} test results to execution ${testExecutionKey}`);
    } catch (error) {
      this.logger.error(`Failed to add tests to execution ${testExecutionKey}: ${error}`);
      throw error;
    }
  }

  /**
   * Update test execution status
   */
  public async updateTestExecutionStatus(testExecutionKey: string, status: 'PASSED' | 'FAILED' | 'IN_PROGRESS'): Promise<void> {
    try {
      const statusMapping = {
        'PASSED': '10000', // Passed
        'FAILED': '10001', // Failed
        'IN_PROGRESS': '10002' // In Progress
      };

      await this.axiosInstance.put(`/issue/${testExecutionKey}`, {
        fields: {
          status: {
            id: statusMapping[status]
          }
        }
      });

      this.logger.info(`Updated test execution ${testExecutionKey} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update test execution status: ${error}`);
      throw error;
    }
  }

  /**
   * Get test execution details
   */
  public async getTestExecution(testExecutionKey: string): Promise<any> {
    try {
      const response: AxiosResponse = await this.axiosInstance.get(`/issue/${testExecutionKey}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get test execution ${testExecutionKey}: ${error}`);
      throw error;
    }
  }

  /**
   * Search for test cases by JQL query
   */
  public async searchTestCases(jql: string): Promise<any[]> {
    try {
      const response: AxiosResponse = await this.axiosInstance.post('/search', {
        jql: jql,
        fields: ['key', 'summary', 'status', 'customfield_10014', 'customfield_10015']
      });

      return response.data.issues || [];
    } catch (error) {
      this.logger.error(`Failed to search test cases: ${error}`);
      throw error;
    }
  }

  /**
   * Get test case details
   */
  public async getTestCase(testKey: string): Promise<any> {
    try {
      const response: AxiosResponse = await this.axiosInstance.get(`/issue/${testKey}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get test case ${testKey}: ${error}`);
      throw error;
    }
  }
}

