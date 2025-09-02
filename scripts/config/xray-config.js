"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XrayConfigManager = void 0;
const dotenv_1 = require("dotenv");
dotenv_1.default.config();
class XrayConfigManager {
    constructor() {
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
    static getInstance() {
        if (!XrayConfigManager.instance) {
            XrayConfigManager.instance = new XrayConfigManager();
        }
        return XrayConfigManager.instance;
    }
    getConfig() {
        return this.config;
    }
    validateConfig() {
        const requiredFields = ['jiraBaseUrl', 'jiraUsername', 'jiraApiToken', 'projectKey'];
        return requiredFields.every(field => this.config[field]);
    }
    getJiraApiUrl() {
        return `${this.config.jiraBaseUrl}/rest/api/3`;
    }
    getXrayApiUrl() {
        return `${this.config.jiraBaseUrl}/rest/api/2`;
    }
    getJiraApiUrlV2() {
        return `${this.config.jiraBaseUrl}/rest/api/2`;
    }
}
exports.XrayConfigManager = XrayConfigManager;
