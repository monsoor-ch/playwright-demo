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
      // Use a simpler approach - create a basic test execution issue
      const response: AxiosResponse = await this.axiosInstance.post('/issue', {
        fields: {
          project: {
            key: this.config.getConfig().projectKey
          },
          summary: execution.info.summary,
          description: execution.info.description || 'Automated test execution from Playwright',
          issuetype: {
            name: 'Test Execution'
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
  private async addTestsToExecution(testExecutionKey: string, tests: XrayTestResult[]): Promise<void> {
    try {
      for (const test of tests) {
        await this.axiosInstance.post('/execution', {
          testExecutionKey,
          testKey: test.testKey,
          status: test.status,
          comment: test.comment || `Test executed via Playwright automation`,
          executionTime: test.executionTime || 0
        });
      }
      this.logger.info(`Added ${tests.length} test results to execution ${testExecutionKey}`);
    } catch (error) {
      this.logger.error(`Failed to add tests to execution: ${error}`);
      throw error;
    }
  }

  /**
   * Update the status of a test execution
   */
  public async updateTestExecutionStatus(testExecutionKey: string, status: string): Promise<void> {
    try {
      await this.axiosInstance.put(`/execution/${testExecutionKey}`, {
        status: status
      });
      this.logger.info(`Updated test execution ${testExecutionKey} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update test execution status: ${error}`);
      throw error;
    }
  }
}

