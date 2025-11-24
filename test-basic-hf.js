#!/usr/bin/env node
/**
 * Test HuggingFace token validity
 */
import { HfInference } from '@huggingface/inference';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function loadEnv() {
  try {
    const envContent = await readFile(join(process.cwd(), '.env'), 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      if (line.includes('=')) {
        const [key, value] = line.split('=');
        process.env[key.trim()] = value.trim();
      }
    }
  } catch (error) {
    console.log('No .env file found or error reading it');
  }
}

async function testBasicHF() {
  await loadEnv();
  
  console.log('🧪 Testing basic HuggingFace token validity...\n');
  
  const hfToken = process.env.HF_TOKEN;
  
  if (!hfToken) {
    console.error('❌ No HF_TOKEN found in environment');
    process.exit(1);
  }
  
  console.log(`✅ HF_TOKEN found: ${hfToken.substring(0, 8)}...`);
  
  const client = new HfInference(hfToken);
  
  try {
    // Test with a simple API call to verify token
    console.log('🔄 Testing token with whoami endpoint...');
    
    const response = await fetch('https://huggingface.co/api/whoami', {
      headers: {
        'Authorization': `Bearer ${hfToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Token is valid! User:', data.name);
    } else {
      console.error('❌ Token validation failed:', response.status, response.statusText);
      return;
    }
    
    // Test simple text completion
    console.log('🔄 Testing simple text completion...');
    
    const result = await client.textGeneration({
      model: 'gpt2',
      inputs: 'Hello world',
      parameters: {
        max_new_tokens: 20
      }
    });
    
    console.log('✅ Text generation worked!');
    console.log('Result:', result.generated_text);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testBasicHF();