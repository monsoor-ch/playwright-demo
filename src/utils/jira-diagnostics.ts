import axios from 'axios';
import { XrayConfigManager } from '../config/xray-config';
import { Logger } from './logger';

export class JiraDiagnostics {
  private static instance: JiraDiagnostics;
  private axiosInstance: axios.AxiosInstance;
  private config: XrayConfigManager;
  private logger: Logger;

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
  }

  public static getInstance(): JiraDiagnostics {
    if (!JiraDiagnostics.instance) {
      JiraDiagnostics.instance = new JiraDiagnostics();
    }
    return JiraDiagnostics.instance;
  }

  /**
   * Check what issue types are available
   */
  public async checkIssueTypes(): Promise<void> {
    try {
      this.logger.info('Checking available issue types...');
      const response = await this.axiosInstance.get('/issuetype');
      
      this.logger.info('Available issue types:');
      response.data.forEach((issueType: any) => {
        this.logger.info(`- ${issueType.name} (ID: ${issueType.id})`);
      });
    } catch (error) {
      this.logger.error(`Failed to check issue types: ${error}`);
    }
  }

  /**
   * Check what projects are available
   */
  public async checkProjects(): Promise<void> {
    try {
      this.logger.info('Checking available projects...');
      const response = await this.axiosInstance.get('/project');
      
      this.logger.info('Available projects:');
      response.data.forEach((project: any) => {
        this.logger.info(`- ${project.name} (Key: ${project.key})`);
      });
    } catch (error) {
      this.logger.error(`Failed to check projects: ${error}`);
    }
  }

  /**
   * Check project details for a specific project
   */
  public async checkProjectDetails(projectKey: string): Promise<void> {
    try {
      this.logger.info(`Checking details for project: ${projectKey}`);
      const response = await this.axiosInstance.get(`/project/${projectKey}`);
      
      this.logger.info(`Project: ${response.data.name} (${response.data.key})`);
      this.logger.info(`Issue types: ${response.data.issueTypes.map((it: any) => it.name).join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to check project details for ${projectKey}: ${error}`);
    }
  }

  /**
   * Run all diagnostics
   */
  public async runDiagnostics(): Promise<void> {
    this.logger.info('=== Jira Diagnostics Started ===');
    
    await this.checkProjects();
    await this.checkIssueTypes();
    
    // Check specific project if configured
    const projectKey = this.config.getConfig().projectKey;
    if (projectKey) {
      await this.checkProjectDetails(projectKey);
    }
    
    this.logger.info('=== Jira Diagnostics Completed ===');
  }
}
