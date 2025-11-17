#!/usr/bin/env tsx
/**
 * Test script for code generation functionality
 */

import { generateExportTool } from '../src/tools/generate.js';

async function testCodeGeneration() {
  console.log('🧪 Testing Code Generation...\n');

  // Use existing discovery data
  const analysisId = 'discovery_1763346972243_az00w2jd';
  const toolName = 'exportModelContextProtocolData';

  console.log(`Analysis ID: ${analysisId}`);
  console.log(`Tool Name: ${toolName}\n`);

  try {
    console.log('⏳ Generating TypeScript export tool...');
    
    const result = await generateExportTool({
      analysisId,
      toolName,
      targetUrl: 'https://modelcontextprotocol.io',
      outputFormat: 'json',
      language: 'typescript'
    });

    if (result.success) {
      console.log('✅ Code generation successful!\n');
      console.log(`📄 File: ${result.fileName}`);
      console.log(`🔧 Language: ${result.language}`);
      console.log(`📂 Path: ${result.generatedPath}`);
      console.log(`📊 Lines of Code: ${result.linesOfCode}`);
      if (result.tokensUsed) {
        console.log(`🪙 Tokens Used: ${result.tokensUsed}`);
      }
      console.log('\n📖 Usage Instructions:\n');
      console.log(result.instructions);
    } else {
      console.error('❌ Code generation failed:');
      console.error(result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test failed with exception:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testCodeGeneration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
