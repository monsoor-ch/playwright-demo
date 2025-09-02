const { JiraDiagnostics } = require('../src/utils/jira-diagnostics');

async function main() {
  try {
    console.log('🔍 Running Jira Diagnostics...\n');
    
    const diagnostics = JiraDiagnostics.getInstance();
    await diagnostics.runDiagnostics();
    
    console.log('\n✅ Diagnostics completed!');
  } catch (error) {
    console.error('❌ Diagnostics failed:', error);
  }
}

main();
