const axios = require('axios');
require('dotenv').config();

async function checkJira() {
  try {
    console.log('🔍 Running Jira Diagnostics...\n');
    
    const config = {
      jiraBaseUrl: process.env.JIRA_BASE_URL,
      jiraUsername: process.env.JIRA_USERNAME,
      jiraApiToken: process.env.JIRA_API_TOKEN,
      projectKey: process.env.JIRA_PROJECT_KEY
    };
    
    console.log('📋 Configuration:');
    console.log(`- Base URL: ${config.jiraBaseUrl}`);
    console.log(`- Username: ${config.jiraUsername}`);
    console.log(`- Project Key: ${config.projectKey}`);
    console.log('');
    
    const axiosInstance = axios.create({
      baseURL: `${config.jiraBaseUrl}/rest/api/2`,
      auth: {
        username: config.jiraUsername,
        password: config.jiraApiToken
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // Check available projects
    console.log('📁 Checking available projects...');
    try {
      const projectsResponse = await axiosInstance.get('/project');
      console.log('Available projects:');
      projectsResponse.data.forEach((project) => {
        console.log(`- ${project.name} (Key: ${project.key})`);
      });
    } catch (error) {
      console.error('❌ Failed to check projects:', error.response?.data || error.message);
    }
    
    console.log('');
    
    // Check available issue types
    console.log('🏷️  Checking available issue types...');
    try {
      const issueTypesResponse = await axiosInstance.get('/issuetype');
      console.log('Available issue types:');
      issueTypesResponse.data.forEach((issueType) => {
        console.log(`- ${issueType.name} (ID: ${issueType.id})`);
      });
    } catch (error) {
      console.error('❌ Failed to check issue types:', error.response?.data || error.message);
    }
    
    console.log('');
    
    // Check specific project if configured
    if (config.projectKey) {
      console.log(`🔍 Checking details for project: ${config.projectKey}`);
      try {
        const projectResponse = await axiosInstance.get(`/project/${config.projectKey}`);
        console.log(`Project: ${projectResponse.data.name} (${projectResponse.data.key})`);
        console.log(`Issue types: ${projectResponse.data.issueTypes.map(it => it.name).join(', ')}`);
      } catch (error) {
        console.error(`❌ Failed to check project details for ${config.projectKey}:`, error.response?.data || error.message);
      }
    }
    
    console.log('\n✅ Diagnostics completed!');
  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
  }
}

checkJira();
