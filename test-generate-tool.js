#!/usr/bin/env node

/**
 * Quick test script to verify generate_export_tool is accessible
 */

import { spawn } from 'child_process';

console.log('🧪 Testing generate_export_tool availability...\n');

const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

server.stdin.write(JSON.stringify(initRequest) + '\n');

// Send tools/list request
const toolsRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list',
  params: {}
};

setTimeout(() => {
  server.stdin.write(JSON.stringify(toolsRequest) + '\n');
}, 500);

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  lines.forEach(line => {
    if (!line.trim()) return;
    
    try {
      const msg = JSON.parse(line);
      
      if (msg.result && msg.result.tools) {
        console.log('✅ Tools available:');
        msg.result.tools.forEach(tool => {
          console.log(`   - ${tool.name}`);
        });
        
        const hasGenerate = msg.result.tools.some(t => t.name === 'generate_export_tool');
        
        if (hasGenerate) {
          console.log('\n🎉 SUCCESS: generate_export_tool is available!');
          
          const generateTool = msg.result.tools.find(t => t.name === 'generate_export_tool');
          console.log('\n📋 Parameters:');
          Object.keys(generateTool.inputSchema.properties || {}).forEach(key => {
            const prop = generateTool.inputSchema.properties[key];
            const required = generateTool.inputSchema.required?.includes(key) ? '(required)' : '(optional)';
            console.log(`   - ${key} ${required}`);
          });
        } else {
          console.log('\n❌ FAILED: generate_export_tool NOT found!');
        }
        
        server.kill();
        process.exit(hasGenerate ? 0 : 1);
      }
    } catch (e) {
      // Ignore parse errors for non-JSON lines
    }
  });
});

setTimeout(() => {
  console.log('\n⏱️  Timeout - killing server');
  server.kill();
  process.exit(1);
}, 5000);
