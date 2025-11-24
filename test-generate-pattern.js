#!/usr/bin/env node
/**
 * Test the exact same call pattern as the generate tool
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

async function testGenerateToolPattern() {
  await loadEnv();
  
  console.log('🧪 Testing exact generate tool pattern...\n');
  
  const hfToken = process.env.HF_TOKEN;
  const client = new HfInference(hfToken);
  
  try {
    // Load the same prompts the generate tool uses
    const systemPrompt = await readFile('prompts/code-generation-system.md', 'utf-8');
    
    console.log('✅ Loaded system prompt, length:', systemPrompt.length);
    
    // Simple user prompt
    const userPrompt = `Generate a TypeScript function that makes HTTP requests to fetch data from an API.
    
API Patterns:
- GET /api/data
- Authentication: none
- Response format: JSON

Generate clean TypeScript code with error handling.`;

    console.log('🔄 Testing with same pattern as generate tool...');
    
    const response = await client.chatCompletion({
      model: 'meta-llama/Llama-3.1-8B-Instruct',
      provider: 'nebius',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user', 
          content: userPrompt,
        },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    });
    
    console.log('✅ Generate tool pattern works!');
    console.log('Response length:', response.choices[0]?.message?.content?.length);
    console.log('First 200 chars:', response.choices[0]?.message?.content?.substring(0, 200));
    
  } catch (error) {
    console.error('❌ Error with generate tool pattern:', error);
    
    // Try with shorter prompts
    try {
      console.log('\n🔄 Trying with shorter prompt...');
      
      const shortResponse = await client.chatCompletion({
        model: 'meta-llama/Llama-3.1-8B-Instruct',
        provider: 'nebius',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful programming assistant.',
          },
          {
            role: 'user',
            content: 'Write a simple TypeScript function that says hello.',
          },
        ],
        max_tokens: 200,
      });
      
      console.log('✅ Short prompt works!');
      console.log(shortResponse.choices[0]?.message?.content);
      
    } catch (error2) {
      console.error('❌ Short prompt also failed:', error2);
    }
  }
}

testGenerateToolPattern();