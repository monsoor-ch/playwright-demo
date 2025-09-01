import dotenv from 'dotenv';

dotenv.config();

export interface XrayConfig {
  jiraBaseUrl: string;
  jiraUsername: string;
  jiraApiToken: string;
  projectKey: string;
  testExecutionKey?: string;
  testPlanKey?: string;
  environment?: string;
  version?: string;
  reporter?: string;
}

export class XrayConfigManager {
  private static instance: XrayConfigManager;
  private config: XrayConfig;

  private constructor() {
    this.config = {
      jiraBaseUrl: process.env.JIRA_BASE_URL || '',
      jiraUsername: process.env.JIRA_USERNAME || '',
      jiraApiToken: process.env.JIRA_API_TOKEN || '',
      projectKey: process.env.JIRA_PROJECT_KEY || '',
      testExecutionKey: process.env.JIRA_TEST_EXECUTION_KEY || undefined,
      testPlanKey: process.env.JIRA_TEST_PLAN_KEY || undefined,
      environment: process.env.JIRA_ENVIRONMENT || 'CI/CD',
      version: process.env.JIRA_VERSION || '1.0.0',
      reporter: process.env.JIRA_REPORTER || 'Playwright Automation'
    };
  }

  public static getInstance(): XrayConfigManager {
    if (!XrayConfigManager.instance) {
      XrayConfigManager.instance = new XrayConfigManager();
    }
    return XrayConfigManager.instance;
  }

  public getConfig(): XrayConfig {
    return this.config;
  }

  public validateConfig(): boolean {
    const requiredFields = ['jiraBaseUrl', 'jiraUsername', 'jiraApiToken', 'projectKey'];
    return requiredFields.every(field => this.config[field as keyof XrayConfig]);
  }

  public getJiraApiUrl(): string {
    return `${this.config.jiraBaseUrl}/rest/api/3`;
  }

  public getXrayApiUrl(): string {
    return `${this.config.jiraBaseUrl}/rest/api/2`;
  }
}

