/**
 * Code generator using Ollama (local, default) or HuggingFace Inference Gateway
 * Configure via LLM_PROVIDER env var: 'ollama' (default) | 'huggingface'
 *
 * Ollama env vars:
 *   OLLAMA_HOST  — base URL (default: http://localhost:11434)
 *   OLLAMA_MODEL — model name (default: qwen2.5-coder:7b)
 *
 * HuggingFace env vars:
 *   HF_TOKEN / HUGGING_FACE_HUB_TOKEN — API token
 *   HF_MODEL — model ID (default: Qwen/Qwen2.5-Coder-32B-Instruct)
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
  description?: string;
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

type LLMProvider = 'ollama' | 'huggingface';

interface OllamaChatResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: { total_tokens?: number };
}

/**
 * Code generator class supporting Ollama (local) and HuggingFace Inference Gateway.
 * Defaults to Ollama. Set LLM_PROVIDER=huggingface to use HF.
 */
export class CodeGenerator {
  private provider: LLMProvider;
  private model: string;
  private ollamaHost: string;
  private hfClient?: HfInference;

  constructor(model?: string) {
    this.provider = (process.env.LLM_PROVIDER as LLMProvider) || 'ollama';
    this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';

    if (this.provider === 'huggingface') {
      const hfToken = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN;
      this.model = model || process.env.HF_MODEL || 'Qwen/Qwen2.5-Coder-32B-Instruct';
      this.hfClient = new HfInference(hfToken);
    } else {
      // Ollama (default)
      this.model = model || process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
    }
  }

  /**
   * Generate export script code using the configured LLM provider
   */
  async generate(options: CodeGenerationOptions): Promise<CodeGenerationResult> {
    try {
      const systemPrompt = await this.loadSystemPrompt();
      const userPrompt = await this.buildPromptFromTemplate(options);

      if (this.provider === 'huggingface') {
        return await this.generateWithHuggingFace(systemPrompt, userPrompt, options.language);
      }
      return await this.generateWithOllama(systemPrompt, userPrompt, options.language);
    } catch (error) {
      return {
        success: false,
        language: options.language,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate code via Ollama's OpenAI-compatible endpoint
   */
  private async generateWithOllama(
    system: string,
    user: string,
    language: string
  ): Promise<CodeGenerationResult> {
    const response = await fetch(`${this.ollamaHost}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const code = this.extractCode(data.choices[0]?.message?.content || '');

    return {
      success: true,
      code,
      language,
      tokensUsed: data.usage?.total_tokens,
    };
  }

  /**
   * Generate code via HuggingFace Inference Gateway
   */
  private async generateWithHuggingFace(
    system: string,
    user: string,
    language: string
  ): Promise<CodeGenerationResult> {
    const response = await this.hfClient!.chatCompletion({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    });

    const code = this.extractCode(response.choices[0]?.message?.content || '');

    return {
      success: true,
      code,
      language,
      tokensUsed: response.usage?.total_tokens,
    };
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
    
    // Add description if provided
    if (options.description) {
      prompt += `## Tool Description\n\n`;
      prompt += `${options.description}\n\n`;
      prompt += `This context should guide your implementation to ensure the generated code is relevant and well-suited for the intended use case.\n\n`;
    }

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
