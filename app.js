const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Create public directory if it doesn't exist
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

// Route to serve the main page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Playwright Automation Framework</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                background-color: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 {
                color: #333;
                text-align: center;
            }
            .status {
                margin: 20px 0;
                padding: 15px;
                border-radius: 5px;
                border-left: 4px solid #007bff;
                background-color: #e3f2fd;
            }
            .success { border-left-color: #28a745; background-color: #d4edda; }
            .warning { border-left-color: #ffc107; background-color: #fff3cd; }
            .error { border-left-color: #dc3545; background-color: #f8d7da; }
            .feature {
                margin: 15px 0;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 5px;
            }
            .feature h3 {
                margin-top: 0;
                color: #495057;
            }
            button {
                background-color: #007bff;
                color: white;
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                margin: 5px;
            }
            button:hover {
                background-color: #0056b3;
            }
            .logs {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 14px;
                margin-top: 20px;
                max-height: 400px;
                overflow-y: auto;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎭 Playwright Automation Framework</h1>
            
            <div class="status success">
                <h3>✅ Framework Status: Ready</h3>
                <p>The TypeScript-based Playwright automation framework is installed and configured.</p>
            </div>

            <div class="feature">
                <h3>Framework Features</h3>
                <ul>
                    <li><strong>Page Object Model (POM)</strong>: Clean separation of page logic and test logic</li>
                    <li><strong>Multi-browser Support</strong>: Chromium, Firefox, WebKit, and mobile browsers</li>
                    <li><strong>External Service Integration</strong>: Azure Blob Storage, Email validation, SFTP operations</li>
                    <li><strong>Comprehensive Logging</strong>: Winston-based structured logging with file output</li>
                    <li><strong>CI/CD Ready</strong>: GitHub Actions workflows included</li>
                </ul>
            </div>

            <div class="feature">
                <h3>Test Management</h3>
                <button onclick="runFrameworkTests()">Run Framework Tests</button>
                <button onclick="viewTestResults()">View Test Results</button>
                <button onclick="showConfiguration()">Show Configuration</button>
            </div>

            <div class="feature">
                <h3>Browser Dependencies Status</h3>
                <div class="status warning">
                    <p><strong>Note:</strong> Browser automation requires additional system dependencies that may not be available in all environments. The framework's core functionality and utilities work independently of browser automation.</p>
                </div>
            </div>

            <div id="output" class="logs" style="display: none;">
                <h4>Output:</h4>
                <div id="logContent"></div>
            </div>
        </div>

        <script>
            async function runFrameworkTests() {
                document.getElementById('output').style.display = 'block';
                const logContent = document.getElementById('logContent');
                logContent.innerHTML = 'Running framework tests...';
                
                try {
                    const response = await fetch('/api/test-framework');
                    const data = await response.json();
                    logContent.innerHTML = '<pre>' + data.output + '</pre>';
                } catch (error) {
                    logContent.innerHTML = '<pre>Error: ' + error.message + '</pre>';
                }
            }

            async function viewTestResults() {
                document.getElementById('output').style.display = 'block';
                const logContent = document.getElementById('logContent');
                logContent.innerHTML = 'Loading test results...';
                
                try {
                    const response = await fetch('/api/test-results');
                    const data = await response.json();
                    logContent.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                } catch (error) {
                    logContent.innerHTML = '<pre>Error: ' + error.message + '</pre>';
                }
            }

            async function showConfiguration() {
                document.getElementById('output').style.display = 'block';
                const logContent = document.getElementById('logContent');
                logContent.innerHTML = 'Loading configuration...';
                
                try {
                    const response = await fetch('/api/config');
                    const data = await response.json();
                    logContent.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                } catch (error) {
                    logContent.innerHTML = '<pre>Error: ' + error.message + '</pre>';
                }
            }
        </script>
    </body>
    </html>
  `);
});

// API endpoints
app.get('/api/test-framework', (req, res) => {
  const { exec } = require('child_process');
  
  exec('npx playwright test tests/config/framework-setup.spec.ts --reporter=json', (error, stdout, stderr) => {
    if (error) {
      res.json({ 
        success: false, 
        output: error.message + '\n' + stderr 
      });
    } else {
      res.json({ 
        success: true, 
        output: stdout 
      });
    }
  });
});

app.get('/api/test-results', (req, res) => {
  try {
    if (fs.existsSync('test-results.json')) {
      const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
      res.json(results);
    } else {
      res.json({ message: 'No test results found. Run tests first.' });
    }
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get('/api/config', (req, res) => {
  try {
    const config = {
      framework: "Playwright TypeScript",
      version: "1.0.0",
      features: [
        "Page Object Model (POM)",
        "Multi-browser testing",
        "Azure Blob Storage integration",
        "Email validation utilities",
        "SFTP client operations",
        "Winston logging",
        "CI/CD workflows"
      ],
      environment: process.env.ENVIRONMENT || 'local',
      baseUrl: process.env.BASE_URL || 'https://www.google.com',
      logLevel: process.env.LOG_LEVEL || 'info'
    };
    res.json(config);
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎭 Playwright Framework Dashboard running on http://localhost:${PORT}`);
  console.log('Framework features:');
  console.log('- Page Object Model architecture');
  console.log('- Multi-browser testing support');
  console.log('- External service integrations');
  console.log('- Comprehensive logging');
  console.log('- CI/CD ready');
});