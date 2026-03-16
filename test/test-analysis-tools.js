/**
 * Quick test for analysis tools
 * Tests analyze_captured_data and discover_api_patterns
 */

import { analyzeCapturedData } from '../dist/tools/analyze.js';
import { discoverApiPatterns } from '../dist/tools/discover.js';
import { DatabaseService } from '../dist/lib/database.js';
import { Storage } from '../dist/lib/storage.js';

async function main() {
  console.log('🧪 Testing Analysis Tools\n');

  // Initialize storage and database (required before calling tool functions directly)
  await Storage.ensureDirectories();
  await DatabaseService.getInstance().initialize();

  // Test 1: Analyze captured data
  console.log('📊 Test 1: Analyzing captured data...');
  const captureId = 'session_1763268089459_de38e0f1';
  
  try {
    const analyzeResult = await analyzeCapturedData({
      captureId,
      includeStaticAssets: false
    });

    if (!analyzeResult.success) {
      console.error('❌ Analysis failed:', analyzeResult.error);
      process.exit(1);
    }

    console.log('✅ Analysis successful!');
    console.log(`   Analysis ID: ${analyzeResult.analysisId}`);
    console.log(`   Total Requests: ${analyzeResult.summary.totalRequests}`);
    console.log(`   API Endpoints: ${analyzeResult.summary.apiEndpoints}`);
    console.log(`   Domains: ${analyzeResult.summary.domains.join(', ')}`);
    console.log(`   Endpoint Groups: ${analyzeResult.endpointGroups.length}`);
    console.log(`   Authentication: ${analyzeResult.authentication.method} (${Math.round(analyzeResult.authentication.confidence * 100)}% confidence)`);
    console.log(`   Status Codes: ${Object.keys(analyzeResult.statusCodes).join(', ')}`);
    console.log(`   Recommendations: ${analyzeResult.recommendations.length} items`);
    console.log('');

    // Test 2: Discover API patterns
    console.log('🎯 Test 2: Discovering API patterns...');
    const discoverResult = await discoverApiPatterns({
      analysisId: analyzeResult.analysisId,
      minConfidence: 0.5,
      includeAuthInsights: true
    });

    if (!discoverResult.success) {
      console.error('❌ Discovery failed:', discoverResult.error);
      process.exit(1);
    }

    console.log('✅ Discovery successful!');
    console.log(`   Discovery ID: ${discoverResult.discoveryId}`);
    console.log(`   Patterns Found: ${discoverResult.patterns.length}`);
    if (discoverResult.patterns.length > 0) {
      console.log('   Pattern Types:');
      discoverResult.patterns.forEach((pattern, i) => {
        console.log(`     ${i + 1}. ${pattern.method} ${pattern.pathPattern} (${pattern.type}, ${Math.round(pattern.confidence * 100)}% confidence)`);
      });
    }
    console.log(`   Pagination: ${discoverResult.pagination.type} (detected: ${discoverResult.pagination.detected})`);
    console.log(`   Rate Limiting: ${discoverResult.rateLimiting.detected ? 'Detected' : 'Not detected'}`);
    console.log(`   Relationships: ${discoverResult.relationships.length}`);
    console.log(`   Recommendations: ${discoverResult.recommendations.length} items`);
    console.log('');

    console.log('🎉 All tests passed!');
    console.log('');
    console.log('📁 Files created:');
    console.log(`   - ${analyzeResult.analysisPath}/analysis.json`);
    console.log(`   - ${discoverResult.discoveryPath}/discovery.json`);

  } catch (error) {
    console.error('❌ Test failed with exception:', error);
    process.exit(1);
  }
}

main();
