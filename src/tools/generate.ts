/**
 * Code generation tool - Generate export scripts from discovered API patterns
 * Uses Claude API for intelligent code generation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from 'zod';
import { CodeGenerator, type CodeGenerationOptions } from "../lib/code-generator.js";
import { DatabaseService } from "../lib/database.js";
import type { APIPattern } from "../lib/pattern-matcher.js";
import { Storage } from "../lib/storage.js";

export interface GenerateOptions {
  discoveryId: string;
  toolName: string;
  description?: string;
  targetUrl?: string;
  outputDirectory?: string;
  outputFormat?: "json" | "csv" | "sqlite";
  incremental?: boolean;
  language?: "typescript" | "python" | "javascript" | "go";
  model?: string;
}

export interface GenerateResult {
  success: boolean;
  generatedPath?: string;
  fileName?: string;
  language: string;
  linesOfCode?: number;
  tokensUsed?: number;
  instructions?: string;
  error?: string;
}

/**
 * Generate export tool from discovered API patterns
 */
export async function generateExportTool(
  options: GenerateOptions
): Promise<GenerateResult> {
  const db = DatabaseService.getInstance();
  let generationId: string | null = null;
  
  try {
    // Generate generation ID first
    generationId = await db.createGeneration(
      options.discoveryId,
      options.toolName,
      options.language || 'typescript'
    );
    
    // Load discovery results to get patterns
    const dataDir = Storage.getDataDirectory();
    const discoveryFile = join(
      dataDir,
      "analyses",
      options.discoveryId,
      "discovery.json"
    );

    const discoveryData = await readFile(discoveryFile, "utf-8");
    const discovery = JSON.parse(discoveryData);

    if (!discovery.patterns || discovery.patterns.length === 0) {
      throw new Error("No API patterns found in discovery results");
    }

    // Determine language (default to TypeScript)
    const language = options.language || "typescript";

    // Prepare code generation options
    const authPatterns = discovery.patterns.filter(
      (p: APIPattern) => p.authMethod !== "none"
    );
    const hasAuth = authPatterns.length > 0;
    const authMethod = hasAuth ? authPatterns[0].authMethod : undefined;

    const hasPagination = discovery.pagination?.type !== "none";
    const hasRateLimiting = discovery.rateLimiting?.detected || false;

    // Determine target URL
    let targetUrl = options.targetUrl;
    if (!targetUrl && discovery.patterns.length > 0) {
      // Extract base URL from first pattern example
      const exampleUrl = discovery.patterns[0].examples[0];
      if (exampleUrl) {
        const url = new URL(exampleUrl);
        targetUrl = `${url.protocol}//${url.host}`;
      }
    }

    const codeGenOptions: CodeGenerationOptions = {
      language: language as any,
      patterns: discovery.patterns,
      toolName: options.toolName,
      description: options.description,
      targetUrl,
      outputFormat: options.outputFormat || "json",
      includeAuth: hasAuth,
      authMethod,
      includeRateLimiting: hasRateLimiting,
      includePagination: hasPagination,
      paginationType: discovery.pagination?.type,
      paginationParams: discovery.pagination?.params,
    };

    // Generate code using configured LLM provider (Ollama or HuggingFace)
    const generator = new CodeGenerator(options.model);
    const result = await generator.generate(codeGenOptions);

    if (!result.success || !result.code) {
      throw new Error(result.error || "Code generation failed");
    }

    // Determine file extension
    const extensions: Record<string, string> = {
      typescript: ".ts",
      javascript: ".js",
      python: ".py",
      go: ".go",
    };
    const extension = extensions[language] || ".txt";
    const fileName = `${options.toolName}${extension}`;

    // Save generated code
    const outputDir = options.outputDirectory || join(dataDir, "generated");
    await mkdir(outputDir, { recursive: true });

    const outputPath = join(outputDir, fileName);
    await writeFile(outputPath, result.code, "utf-8");

    // Count lines of code
    const linesOfCode = result.code.split("\n").length;

    // Generate usage instructions
    const instructions = generateUsageInstructions(
      options.toolName,
      language,
      fileName,
      hasAuth,
      hasPagination,
      hasRateLimiting,
      options.outputFormat || "json",
      generationId
    );

    // Update database record with results
    await db.updateGeneration(generationId, {
      status: 'complete',
      filePath: outputPath,
      linesOfCode,
      tokensUsed: result.tokensUsed
    });

    return {
      success: true,
      generatedPath: outputPath,
      fileName,
      language,
      linesOfCode,
      tokensUsed: result.tokensUsed,
      instructions,
    };
  } catch (error) {
    // Update database record if we have a generation ID
    if (generationId) {
      await db.updateGeneration(generationId, { status: 'failed' });
    }
    
    return {
      success: false,
      language: options.language || "typescript",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate usage instructions for the generated tool
 */
function generateUsageInstructions(
  toolName: string,
  language: string,
  fileName: string,
  hasAuth: boolean,
  hasPagination: boolean,
  hasRateLimiting: boolean,
  outputFormat: string,
  generationId: string
): string {
  let instructions = `# Usage Instructions for ${fileName}\n\n`;

  // Language-specific execution
  switch (language) {
    case "typescript":
      instructions += `## Run with tsx:\n\`\`\`bash\ntsx ${fileName}`;
      break;
    case "javascript":
      instructions += `## Run with Node.js:\n\`\`\`bash\nnode ${fileName}`;
      break;
    case "python":
      instructions += `## Run with Python:\n\`\`\`bash\npython ${fileName}`;
      break;
    case "go":
      instructions += `## Build and run:\n\`\`\`bash\ngo build ${fileName}\n./${fileName.replace(".go", "")}`;
      break;
  }

  // Add common options
  if (hasAuth) {
    instructions += " --auth YOUR_TOKEN";
  }
  instructions += ` --output data.${outputFormat}`;
  if (hasRateLimiting) {
    instructions += " --delay 1000";
  }
  instructions += "\n```\n\n";

  // Add feature notes
  instructions += "## Features:\n";
  instructions += `- Output format: ${outputFormat.toUpperCase()}\n`;
  if (hasAuth) {
    instructions += "- Authentication: Required (pass via --auth flag or environment variable)\n";
  }
  if (hasPagination) {
    instructions += "- Pagination: Automatic iteration through all pages\n";
  }
  if (hasRateLimiting) {
    instructions += "- Rate limiting: Configurable delays between requests\n";
  }
  instructions += "- Error handling: Automatic retries on failure\n";
  instructions += "- Logging: Progress tracking to console\n\n";

  // Add notes
  instructions += "## Notes:\n";
  instructions += "- Review the generated code before running\n";
  instructions += "- Customize authentication, URLs, or parameters as needed\n";
  instructions += "- Test with a small dataset first\n";
  instructions += "- Monitor rate limits to avoid being blocked\n\n";

  // Add generation completion info
  instructions += "## Generation Complete! \u2705\n";
  instructions += `\ud83d\udccb Generation ID: ${generationId}\n`;
  instructions += `\ud83d\udd27 Tool Name: ${toolName}\n`;
  instructions += `\ud83d\udcca Use 'list_all_ids' to see the complete workflow chain\n`;

  return instructions;
}

export function registerGenerateTool(server: McpServer): void {
  server.registerTool(
    'generate_export_tool',
    {
      title: 'Generate Export Tool',
      description:
        'Generates runnable export scripts from discovered API patterns. Include a description field to provide context for better code generation. LLMs should provide both toolName and description to help the code generation model create more relevant, contextual code.',
      inputSchema: z.object({
        discoveryId: z.string().min(1),
        toolName: z.string().min(1),
        description: z.string().min(1).describe('Description of what the tool does and what data it extracts.').nullable().optional(),
        model: z.string().min(1).default('qwen2.5-coder:7b').describe('Model to use. For Ollama: e.g. qwen2.5-coder:7b. For HuggingFace: e.g. Qwen/Qwen2.5-Coder-32B-Instruct.').nullable().optional(),
        targetUrl: z.string().url().nullable().optional(),
        outputDirectory: z.string().nullable().optional(),
        outputFormat: z.enum(['json', 'csv', 'sqlite']).default('json').optional(),
        incremental: z.boolean().optional(),
        language: z.enum(['typescript', 'python', 'javascript', 'go']).default('typescript').optional()
      }).shape
    },
    async ({ discoveryId, toolName, description, model, targetUrl, outputDirectory, outputFormat, incremental, language }) => {
      try {
        const result = await generateExportTool({
          discoveryId,
          toolName,
          description: description ?? undefined,
          model: model ?? undefined,
          targetUrl: targetUrl ?? undefined,
          outputDirectory: outputDirectory ?? undefined,
          outputFormat,
          incremental,
          language
        });

        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: `Failed to generate export tool: ${result.error}` }],
            isError: true
          };
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: [
                '# 🎉 Export Tool Generated Successfully',
                '',
                `**File:** ${result.fileName}`,
                `**Language:** ${result.language}`,
                `**Path:** ${result.generatedPath}`,
                `**Lines of Code:** ${result.linesOfCode}`,
                result.tokensUsed ? `**Tokens Used:** ${result.tokensUsed}` : '',
                '',
                '## 📖 Usage Instructions',
                '',
                result.instructions || 'See the generated file for usage instructions.',
                '',
                '## ⚠️ Important Notes',
                '',
                '1. **Review the code** before running it',
                '2. **Test with small datasets** first',
                '3. **Monitor rate limits** to avoid being blocked',
                '4. **Customize as needed** for your specific use case',
                '',
                '## 🚀 Next Steps',
                '',
                '1. Review and test the generated export tool',
                '2. Run it to export data from the target API',
                '3. Use search_exported_data to query the exported data'
              ]
                .filter(line => line !== '')
                .join('\n')
            }
          ]
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error generating export tool: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true
        };
      }
    }
  );
}
