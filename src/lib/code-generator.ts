/**
 * Code generator using Nebius Token Factory (OpenAI-compatible API) and Handlebars templates
 * Generates export scripts in multiple languages from discovered API patterns
 */

import { HfInference } from "@huggingface/inference";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { APIPattern } from "./pattern-matcher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "../..");

export interface CodeGenerationOptions {
  language: "typescript" | "python" | "javascript" | "go";
  patterns: APIPattern[];
  toolName: string;
  targetUrl?: string;
  outputFormat: "json" | "csv" | "sqlite";
  includeAuth: boolean;
  authMethod?: string;
  includeRateLimiting: boolean;
  includePagination: boolean;
  paginationType?: string;
  paginationParams?: Record<string, string>;
}

export interface CodeGenerationResult {
  success: boolean;
  code?: string;
  language: string;
  tokensUsed?: number;
  error?: string;
}

/**
 * Code generator class using HuggingFace Inference with Nebius provider
 * API key is securely stored in HuggingFace account settings
 */
export class CodeGenerator {
  private client: HfInference;
  private model: string;

  constructor(model?: string) {
    // HuggingFace token should be set in environment or HF config
    // Nebius API key should be configured in HuggingFace account:
    // https://huggingface.co/settings/inference-providers
    const hfToken = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN;
    
    this.model = model || process.env.NEBIUS_MODEL || "Qwen/Qwen2.5-VL-72B-Instruct";
    
    this.client = new HfInference(hfToken);
  }

  /**
   * Generate export script code using HuggingFace Inference with Nebius provider
   */
  async generate(options: CodeGenerationOptions): Promise<CodeGenerationResult> {
    try {
      const systemPrompt = await this.loadSystemPrompt();
      const userPrompt = await this.buildPromptFromTemplate(options);

      const response = await this.client.chatCompletion({
        model: this.model,
        provider: "nebius",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 4096,
      });

      const code = this.extractCode(response.choices[0]?.message?.content || "");

      return {
        success: true,
        code,
        language: options.language,
        tokensUsed: response.usage?.total_tokens,
      };
    } catch (error) {
      return {
        success: false,
        language: options.language,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Load system prompt from file
   */
  private async loadSystemPrompt(): Promise<string> {
    try {
      const systemPromptPath = join(PROJECT_ROOT, "prompts", "code-generation-system.md");
      return await readFile(systemPromptPath, "utf-8");
    } catch {
      // Fallback to inline prompt if file not found
      return "You are an expert programmer who generates clean, production-ready code. Always output only the code without explanations or markdown formatting. Use native HTTP clients (fetch for TypeScript/JavaScript, requests for Python).";
    }
  }

  /**
   * Build prompt from template using current options
   */
  private async buildPromptFromTemplate(options: CodeGenerationOptions): Promise<string> {
    const languageDetails = this.getLanguageDetails(options.language);
    
    // Load language-specific guidance if available
    let languageGuidance = "";
    try {
      const guidancePath = join(PROJECT_ROOT, "prompts", `code-generation-${options.language}.md`);
      languageGuidance = await readFile(guidancePath, "utf-8");
    } catch {
      // No language-specific guidance, that's okay
    }

    let prompt = languageGuidance ? `${languageGuidance}\n\n---\n\n` : "";
    
    prompt += `Generate a ${options.language} script named "${options.toolName}" that exports data from the following API endpoints:\n\n`;

    // Add API patterns
    prompt += "## API Endpoints\n\n";
    options.patterns.forEach((pattern, idx) => {
      prompt += `### Endpoint ${idx + 1}\n`;
      prompt += `- Type: ${pattern.type}\n`;
      prompt += `- Method: ${pattern.method}\n`;
      prompt += `- Path Pattern: ${pattern.pathPattern}\n`;
      prompt += `- Example: ${pattern.examples[0] || "N/A"}\n`;

      if (pattern.pathParams && pattern.pathParams.length > 0) {
        prompt += `- Path Parameters: ${pattern.pathParams.join(", ")}\n`;
      }

      if (pattern.queryParams && pattern.queryParams.length > 0) {
        prompt += `- Query Parameters: ${pattern.queryParams.join(", ")}\n`;
      }

      if (pattern.requiredHeaders && Object.keys(pattern.requiredHeaders).length > 0) {
        prompt += `- Required Headers:\n`;
        Object.entries(pattern.requiredHeaders).forEach(([key, value]) => {
          prompt += `  - ${key}: ${value}\n`;
        });
      }

      prompt += "\n";
    });

    // Add authentication requirements
    if (options.includeAuth && options.authMethod) {
      prompt += `## Authentication\n\n`;
      prompt += `- Method: ${options.authMethod}\n`;
      prompt += `- The script should accept authentication credentials as command-line arguments or environment variables\n\n`;
    }

    // Add pagination requirements
    if (options.includePagination && options.paginationType) {
      prompt += `## Pagination\n\n`;
      prompt += `- Type: ${options.paginationType}\n`;
      if (options.paginationParams) {
        prompt += `- Parameters: ${JSON.stringify(options.paginationParams, null, 2)}\n`;
      }
      prompt += `- The script should automatically iterate through all pages\n\n`;
    }

    // Add rate limiting requirements
    if (options.includeRateLimiting) {
      prompt += `## Rate Limiting\n\n`;
      prompt += `- Implement rate limiting with configurable delays between requests\n`;
      prompt += `- Respect rate limit headers if present\n\n`;
    }

    // Add output format requirements
    prompt += `## Output Format\n\n`;
    prompt += `- Format: ${options.outputFormat}\n`;
    prompt += `- Save data to a file with an appropriate name\n\n`;

    // Add language-specific requirements
    prompt += `## Requirements\n\n`;
    prompt += `- Language: ${options.language}\n`;
    prompt += `- Use ${languageDetails.httpClient} for HTTP requests\n`;
    prompt += `- Include proper error handling and retry logic\n`;
    prompt += `- Add informative logging to track progress\n`;
    prompt += `- Make the script executable and well-documented\n`;
    prompt += `- Include usage instructions as comments at the top\n`;
    prompt += `- Use type annotations where applicable\n\n`;

    prompt += `Generate ONLY the complete, production-ready code without any explanations or markdown formatting. The code should be ready to save and run immediately.`;

    return prompt;
  }

  /**
   * Extract code from the LLM response
   */
  private extractCode(content: string): string {
    let code = content;

    // Remove markdown code blocks if present
    code = code.replace(/```[a-z]*\n/g, "").replace(/```\s*$/g, "");

    return code.trim();
  }

  /**
   * Get language-specific details
   */
  private getLanguageDetails(language: string): {
    httpClient: string;
    extension: string;
  } {
    switch (language) {
      case "typescript":
        return { httpClient: "axios or fetch", extension: ".ts" };
      case "javascript":
        return { httpClient: "axios or fetch", extension: ".js" };
      case "python":
        return { httpClient: "requests or httpx", extension: ".py" };
      case "go":
        return { httpClient: "net/http", extension: ".go" };
      default:
        return { httpClient: "native HTTP client", extension: ".txt" };
    }
  }
}

/**
 * Template-based code generator (fallback or simple cases)
 * Uses Handlebars templates for basic code generation
 */
export class TemplateCodeGenerator {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  /**
   * Load a template from file
   */
  async loadTemplate(language: string, templatePath: string): Promise<void> {
    const content = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(content);
    this.templates.set(language, template);
  }

  /**
   * Generate code from template
   */
  generate(language: string, context: Record<string, any>): string {
    const template = this.templates.get(language);
    if (!template) {
      throw new Error(`Template for ${language} not loaded`);
    }
    return template(context);
  }

  /**
   * Register Handlebars helpers
   */
  registerHelpers(): void {
    // Helper to format method names
    Handlebars.registerHelper("methodName", (pattern: APIPattern) => {
      return `fetch${pattern.type.charAt(0).toUpperCase() + pattern.type.slice(1)}`;
    });

    // Helper to format path parameters
    Handlebars.registerHelper("pathParams", (params: string[]) => {
      return params.map((p) => `${p}: string`).join(", ");
    });

    // Helper to format query parameters
    Handlebars.registerHelper("queryParams", (params: string[]) => {
      return params.map((p) => `${p}?: string`).join(", ");
    });

    // Helper for conditional blocks
    Handlebars.registerHelper("ifEquals", function (this: any, arg1: any, arg2: any, options: any) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    // Helper to convert to camelCase
    Handlebars.registerHelper("camelCase", (str: string) => {
      return str
        .replace(/[-_](.)/g, (_, char) => char.toUpperCase())
        .replace(/^(.)/, (char) => char.toLowerCase());
    });
  }
}
