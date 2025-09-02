"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraDiagnostics = void 0;
const axios_1 = require("axios");
const xray_config_1 = require("../config/xray-config");
const logger_1 = require("./logger");
class JiraDiagnostics {
    constructor() {
        this.config = xray_config_1.XrayConfigManager.getInstance();
        this.logger = logger_1.Logger.getInstance();
        this.axiosInstance = axios_1.default.create({
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
    static getInstance() {
        if (!JiraDiagnostics.instance) {
            JiraDiagnostics.instance = new JiraDiagnostics();
        }
        return JiraDiagnostics.instance;
    }
    /**
     * Check what issue types are available
     */
    async checkIssueTypes() {
        try {
            this.logger.info('Checking available issue types...');
            const response = await this.axiosInstance.get('/issuetype');
            this.logger.info('Available issue types:');
            response.data.forEach((issueType) => {
                this.logger.info(`- ${issueType.name} (ID: ${issueType.id})`);
            });
        }
        catch (error) {
            this.logger.error(`Failed to check issue types: ${error}`);
        }
    }
    /**
     * Check what projects are available
     */
    async checkProjects() {
        try {
            this.logger.info('Checking available projects...');
            const response = await this.axiosInstance.get('/project');
            this.logger.info('Available projects:');
            response.data.forEach((project) => {
                this.logger.info(`- ${project.name} (Key: ${project.key})`);
            });
        }
        catch (error) {
            this.logger.error(`Failed to check projects: ${error}`);
        }
    }
    /**
     * Check project details for a specific project
     */
    async checkProjectDetails(projectKey) {
        try {
            this.logger.info(`Checking details for project: ${projectKey}`);
            const response = await this.axiosInstance.get(`/project/${projectKey}`);
            this.logger.info(`Project: ${response.data.name} (${response.data.key})`);
            this.logger.info(`Issue types: ${response.data.issueTypes.map((it) => it.name).join(', ')}`);
        }
        catch (error) {
            this.logger.error(`Failed to check project details for ${projectKey}: ${error}`);
        }
    }
    /**
     * Run all diagnostics
     */
    async runDiagnostics() {
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
exports.JiraDiagnostics = JiraDiagnostics;
