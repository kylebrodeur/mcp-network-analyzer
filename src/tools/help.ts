/**
 * Help and documentation tool for MCP Network Analyzer
 * Provides comprehensive guidance on usage, workflow, and best practices
 */

import { DatabaseService } from '../lib/database.js';

export interface HelpSection {
  title: string;
  content: string;
}

export interface WorkflowExample {
  title: string;
  description: string;
  steps: Array<{
    step: number;
    tool: string;
    description: string;
    parameters?: Record<string, any>;
    example?: string;
  }>;
}

export class HelpSystem {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Get overview of the MCP Network Analyzer
   */
  public getOverview(): HelpSection {
    return {
      title: "MCP Network Analyzer Overview",
      content: `
# MCP Network Analyzer

The MCP Network Analyzer is a powerful tool for capturing, analyzing, and understanding web application network traffic. It helps you:

## 🎯 Key Capabilities

- **Capture network traffic** from any website using real browsers
- **Analyze API patterns** to understand data structures and authentication
- **Discover relationships** between endpoints and pagination patterns  
- **Generate export tools** automatically based on discovered patterns
- **Search and query** captured data efficiently

## 🔄 Five-Phase Workflow

1. **Capture** → Record network traffic from a target website
2. **Analyze** → Parse requests/responses to understand API structure  
3. **Discover** → Find patterns, pagination, and data relationships
4. **Generate** → Create custom export tools based on patterns
5. **Search** → Query and filter the captured data

## 🛡️ Security Features

- **Session isolation** - Each capture session is isolated for privacy
- **Secure ID management** - Only access your own session data
- **Authentication handling** - Preserves cookies and headers automatically

## 🚀 Getting Started

Use \`get_help\` with specific topics like "workflow", "tools", "examples", or "security" for detailed guidance.
      `.trim()
    };
  }

  /**
   * Get detailed workflow explanation
   */
  public getWorkflowGuide(): HelpSection {
    return {
      title: "Complete Workflow Guide",
      content: `
# Complete Workflow Guide

## Phase 1: Capture Network Traffic 🌐

**Tool:** \`capture_network_requests\`

Captures all HTTP requests/responses from a website using a real browser.

### Required Parameters:
- \`url\`: Target website URL
- \`sessionId\`: Unique identifier for this capture session

### Optional Parameters:
- \`waitForNetworkIdleMs\`: Wait time after network activity stops (default: 2000)
- \`includeResourceTypes\`: Filter specific resource types ["document", "xhr", "fetch", "websocket"]
- \`excludeResourceTypes\`: Exclude resource types ["image", "stylesheet", "font"]
- \`ignoreStaticAssets\`: Skip images, CSS, fonts, etc. (default: false)

**Best Practices:**
- Use descriptive sessionIds like "amazon-product-search"
- Set reasonable wait times (2-5 seconds for most sites)
- Exclude static assets for API-focused analysis

---

## Phase 2: Analyze Captured Data 📊

**Tool:** \`analyze_captured_data\`

Parses the captured traffic to identify API endpoints, authentication patterns, and data structures.

### Required Parameters:
- \`captureId\`: ID from the capture phase

### Optional Parameters:
- \`includeStaticAssets\`: Include images, CSS in analysis (default: false)
- \`outputPath\`: Custom output location

**What it discovers:**
- API endpoint patterns and groupings
- Authentication methods (cookies, headers, tokens)
- Response data types and structures
- Error patterns and status codes
- Domain usage and request distribution

---

## Phase 3: Discover API Patterns 🔍

**Tool:** \`discover_api_patterns\`

Deep analysis to understand REST patterns, pagination, and relationships between endpoints.

### Required Parameters:
- \`analysisId\`: ID from the analysis phase

### Optional Parameters:
- \`minConfidence\`: Minimum confidence threshold (0.0-1.0, default: 0.5)
- \`includeAuthInsights\`: Include detailed auth analysis (default: false)

**What it discovers:**
- RESTful API patterns (CRUD operations)
- Pagination mechanisms (offset, cursor, page-based)
- Data model schemas and relationships
- Rate limiting indicators
- Endpoint dependencies and workflows

---

## Phase 4: Generate Export Tools 🛠️

**Tool:** \`generate_export_tool\`

Creates runnable scripts to extract data from the discovered API patterns.

### Required Parameters:
- \`discoveryId\`: ID from the discovery phase
- \`toolName\`: Name for the generated tool

### Optional Parameters:
- \`description\`: What the tool does (improves code quality)
- \`language\`: Output language ["typescript", "python", "javascript", "go"]
- \`outputFormat\`: Data format ["json", "csv", "sqlite"]
- \`targetUrl\`: Override target URL
- \`incremental\`: Support incremental data updates
- \`model\`: LLM model for code generation

**Generated tools include:**
- Authentication handling
- Pagination support  
- Error handling and retries
- Rate limiting compliance
- Data transformation and output

---

## Phase 5: Search Exported Data 🔍

**Tool:** \`search_exported_data\`

Query and filter the captured network data.

### Required Parameters:
- \`query\`: Search terms or filters

### Optional Parameters:
- \`captureId\`: Limit to specific capture
- \`statusCode\`: Filter by HTTP status codes
- \`limit\`: Maximum results (default: 100)
- \`includeResponses\`: Include response bodies

**Search capabilities:**
- Full-text search across URLs and responses
- Filter by status codes, domains, time ranges
- Aggregate statistics and summaries
- Export results in various formats
      `.trim()
    };
  }

  /**
   * Get tool reference guide
   */
  public getToolReference(): HelpSection {
    return {
      title: "Tool Reference Guide",
      content: `
# Tool Reference Guide

## Core Workflow Tools

### 🌐 capture_network_requests
Capture network traffic from any website using real browsers.

**Security:** Uses session isolation - only you can see your capture data.

**Parameters:**
- \`url\` (required): Target website URL
- \`sessionId\` (optional): Custom session ID, or use \`generate_session_id\`
- \`waitForNetworkIdleMs\`: Wait time after network stops (2000ms default)
- \`includeResourceTypes\`: Resource types to include
- \`excludeResourceTypes\`: Resource types to exclude  
- \`ignoreStaticAssets\`: Skip images/CSS/fonts (false default)

---

### 📊 analyze_captured_data
Parse captured traffic to understand API structure and authentication.

**Parameters:**
- \`captureId\` (required): ID from capture phase
- \`includeStaticAssets\`: Include static resources (false default)
- \`outputPath\`: Custom save location

**Output:** Analysis ID for next phase

---

### 🔍 discover_api_patterns  
Deep analysis to find REST patterns, pagination, and relationships.

**Parameters:**
- \`analysisId\` (required): ID from analysis phase
- \`minConfidence\`: Pattern confidence threshold (0.5 default)
- \`includeAuthInsights\`: Detailed auth analysis (false default)

**Output:** Discovery ID for code generation

---

### 🛠️ generate_export_tool
Generate runnable export scripts from discovered patterns.

**Parameters:**
- \`discoveryId\` (required): ID from discovery phase  
- \`toolName\` (required): Name for generated tool
- \`description\`: Tool purpose (improves code quality)
- \`language\`: typescript|python|javascript|go (typescript default)
- \`outputFormat\`: json|csv|sqlite (json default)
- \`incremental\`: Support incremental updates (false default)

**Output:** Runnable export script

---

### 🔎 search_exported_data
Query and filter captured network data.

**Parameters:**
- \`query\` (required): Search terms or filters
- \`captureId\`: Limit to specific capture  
- \`statusCode\`: Filter by HTTP status
- \`limit\`: Max results (100 default)
- \`includeResponses\`: Include response bodies (false default)

## ID Management Tools (Secure)

### 📋 list_session_ids
List all IDs for a specific session (secure).

**Parameters:**
- \`sessionId\` (required): Session to view

### 🎯 get_next_session_ids  
Get IDs ready for the next workflow phase (secure).

**Parameters:**
- \`sessionId\` (required): Session to check

### ✅ validate_id
Check if an ID exists and validate session access.

**Parameters:**
- \`id\` (required): ID to validate
- \`type\` (required): capture|analysis|discovery|generation
- \`sessionId\`: Validate session access

### 🔗 get_workflow_chain
Show complete workflow chain for an ID.

**Parameters:**
- \`id\` (required): Any workflow ID  
- \`sessionId\`: Validate session access

### 🆔 generate_session_id
Generate a unique session ID for captures.

**No parameters required**

## Help Tools

### ❓ get_help
Get help on specific topics.

**Parameters:**
- \`topic\`: "overview"|"workflow"|"tools"|"examples"|"security"|"troubleshooting"
      `.trim()
    };
  }

  /**
   * Get workflow examples
   */
  public getWorkflowExamples(): WorkflowExample[] {
    return [
      {
        title: "Basic API Discovery Workflow",
        description: "Complete workflow from capture to code generation for a REST API",
        steps: [
          {
            step: 1,
            tool: "generate_session_id",
            description: "Generate a unique session ID",
            example: "Result: session_1234567890_abcd1234"
          },
          {
            step: 2,
            tool: "capture_network_requests",
            description: "Capture network traffic from the target site",
            parameters: {
              url: "https://api.example.com",
              sessionId: "session_1234567890_abcd1234",
              waitForNetworkIdleMs: 3000
            },
            example: "Captures all API calls made by the website"
          },
          {
            step: 3,
            tool: "list_session_ids",
            description: "Get the capture ID for analysis",
            parameters: {
              sessionId: "session_1234567890_abcd1234"
            },
            example: "Returns: capture_1234567890_xyz789"
          },
          {
            step: 4,
            tool: "analyze_captured_data",
            description: "Analyze the captured traffic",
            parameters: {
              captureId: "capture_1234567890_xyz789"
            },
            example: "Identifies API endpoints and auth patterns"
          },
          {
            step: 5,
            tool: "discover_api_patterns",
            description: "Find REST patterns and relationships",
            parameters: {
              analysisId: "analysis_1234567890_def456"
            },
            example: "Discovers pagination and CRUD patterns"
          },
          {
            step: 6,
            tool: "generate_export_tool",
            description: "Generate a data export tool",
            parameters: {
              discoveryId: "discovery_1234567890_ghi789",
              toolName: "user-data-exporter",
              description: "Export user profiles and activity data",
              language: "typescript"
            },
            example: "Creates a runnable TypeScript export script"
          }
        ]
      },
      {
        title: "E-commerce Product Data Extraction",
        description: "Extract product information from an e-commerce site",
        steps: [
          {
            step: 1,
            tool: "capture_network_requests", 
            description: "Capture traffic while browsing products",
            parameters: {
              url: "https://shop.example.com/products",
              sessionId: "ecommerce-products-session",
              ignoreStaticAssets: true
            }
          },
          {
            step: 2,
            tool: "analyze_captured_data",
            description: "Focus on API endpoints only",
            parameters: {
              captureId: "capture_id_from_step1",
              includeStaticAssets: false
            }
          },
          {
            step: 3,
            tool: "discover_api_patterns",
            description: "Find product API patterns",
            parameters: {
              analysisId: "analysis_id_from_step2",
              minConfidence: 0.7
            }
          },
          {
            step: 4,
            tool: "generate_export_tool", 
            description: "Create product data exporter",
            parameters: {
              discoveryId: "discovery_id_from_step3",
              toolName: "product-catalog-exporter",
              description: "Export product names, prices, descriptions, and availability",
              outputFormat: "csv",
              language: "python"
            }
          }
        ]
      }
    ];
  }

  /**
   * Get security best practices
   */
  public getSecurityGuide(): HelpSection {
    return {
      title: "Security and Best Practices",
      content: `
# Security and Best Practices

## 🛡️ Session Isolation

**Every capture is isolated by session ID:**
- Use unique session IDs for different projects
- Only you can access your session data
- Session validation prevents cross-session access

**Best Practices:**
- Generate session IDs with \`generate_session_id\`
- Use descriptive session names: "project-name-YYYY-MM-DD"
- Always specify sessionId when listing IDs

## 🔐 Authentication Handling

**The tool preserves authentication automatically:**
- Cookies are captured and can be reused
- Authorization headers are detected
- Login sessions persist throughout capture

**Security Notes:**
- Captured auth tokens are stored locally only
- No data is sent to external services (except for code generation)
- Review generated tools before running them

## 🎯 Rate Limiting and Ethics

**Be respectful of target websites:**
- Use reasonable wait times (2-5 seconds)
- Don't overwhelm servers with requests
- Check robots.txt and terms of service
- Consider using development/staging environments

**Rate Limiting Detection:**
- The tool detects rate limiting headers
- Generated tools include backoff strategies
- Monitor for 429 status codes

## 📊 Data Privacy

**Local Storage:**
- All data stored locally in \`data/\` directory
- No data transmitted except for LLM code generation
- You control what data to capture and analyze

**Generated Tools:**
- Review generated code before execution
- Customize for your specific privacy requirements
- Test with small datasets first

## ⚠️ Important Warnings

### Before Capturing:
1. **Check legal compliance** - Ensure you have permission
2. **Review terms of service** - Some sites prohibit automated access
3. **Use test environments** - When possible, test on staging/dev sites
4. **Start small** - Capture limited data initially

### Before Running Generated Tools:
1. **Review all code** - Understand what it does
2. **Test incrementally** - Start with small data sets
3. **Monitor performance** - Watch for rate limiting
4. **Backup original data** - Before making changes

### General Guidelines:
- **Respect robots.txt** and rate limits
- **Don't capture sensitive data** unnecessarily
- **Use secure networks** when dealing with auth data
- **Keep tools updated** for security patches
      `.trim()
    };
  }

  /**
   * Get troubleshooting guide
   */
  public getTroubleshootingGuide(): HelpSection {
    return {
      title: "Troubleshooting Guide",
      content: `
# Troubleshooting Guide

## 🔧 Common Issues and Solutions

### Capture Issues

**Problem: No requests captured**
- ✅ Check if the website loads properly
- ✅ Increase \`waitForNetworkIdleMs\` to 5000-10000
- ✅ Try without \`ignoreStaticAssets\`
- ✅ Check for JavaScript-heavy sites that load data dynamically

**Problem: Authentication not working**
- ✅ Manually log in during capture process
- ✅ Check if login persists across page loads
- ✅ Look for session cookies in captured data
- ✅ Some sites use complex OAuth flows

### Analysis Issues

**Problem: No API endpoints detected**  
- ✅ Set \`includeStaticAssets: false\` 
- ✅ Check if site uses GraphQL (different pattern)
- ✅ Verify requests are actually API calls vs page loads
- ✅ Look for XHR/Fetch requests specifically

**Problem: Analysis fails with errors**
- ✅ Check capture data integrity
- ✅ Verify JSON format in captured files
- ✅ Look for corrupted response data
- ✅ Try with smaller data sets first

### Discovery Issues

**Problem: Low confidence patterns**
- ✅ Lower \`minConfidence\` threshold to 0.3
- ✅ Capture more diverse data (different pages/actions)
- ✅ Check for consistent URL patterns
- ✅ Some APIs use non-standard patterns

**Problem: No pagination detected**
- ✅ Ensure you navigated through pages during capture
- ✅ Look for offset/limit/page parameters manually
- ✅ Some pagination is JavaScript-only

### Generation Issues

**Problem: Generated tool doesn't work**
- ✅ Check authentication requirements
- ✅ Verify API endpoints are still valid
- ✅ Update base URLs if needed
- ✅ Test individual endpoints first

**Problem: Code quality issues**
- ✅ Provide detailed \`description\` parameter
- ✅ Try different language/model combinations
- ✅ Review and manually fix generated code
- ✅ Use simpler discovery patterns

## 🔍 Debugging Tips

### Capture Debugging:
\`\`\`bash
# Check captured files manually
ls data/captures/session_*/
cat data/captures/session_*/metadata.json
\`\`\`

### Analysis Debugging:
\`\`\`bash
# Check analysis results
ls data/analyses/analysis_*/
cat data/analyses/analysis_*/analysis.json | jq '.summary'
\`\`\`

### Discovery Debugging:
\`\`\`bash
# Check discovered patterns
ls data/analyses/discovery_*/
cat data/analyses/discovery_*/discovery.json | jq '.patterns[0]'
\`\`\`

## 📞 Getting Help

1. **Use workflow tools:**
   - \`get_workflow_chain\` to see current state
   - \`validate_id\` to check ID validity
   - \`list_session_ids\` to see available data

2. **Check logs and errors:**
   - Look at tool output messages
   - Check file paths and permissions
   - Verify network connectivity

3. **Start fresh if needed:**
   - Generate new session ID
   - Begin with simpler target sites
   - Capture smaller data sets initially

## 🎯 Best Practices for Success

1. **Start simple:** Begin with well-known APIs
2. **Iterate gradually:** Add complexity incrementally  
3. **Test frequently:** Validate each step before proceeding
4. **Document findings:** Note what works and what doesn't
5. **Review generated code:** Always inspect before running
      `.trim()
    };
  }

  /**
   * Get help for a specific topic
   */
  public async getHelp(topic?: string): Promise<HelpSection | WorkflowExample[]> {
    switch (topic?.toLowerCase()) {
      case 'workflow':
        return this.getWorkflowGuide();
      
      case 'tools':
        return this.getToolReference();
      
      case 'examples':
        return this.getWorkflowExamples();
      
      case 'security':
        return this.getSecurityGuide();
      
      case 'troubleshooting':
        return this.getTroubleshootingGuide();
      
      default:
        return this.getOverview();
    }
  }

  /**
   * Get contextual help based on current session state
   */
  public async getContextualHelp(sessionId: string): Promise<HelpSection> {
    await this.db.initialize();

    const captures = this.db.listCapturesBySession(sessionId);
    const analyses = this.db.listAnalysesBySession(sessionId);
    const discoveries = this.db.listDiscoveriesBySession(sessionId);
    const generations = this.db.listGenerationsBySession(sessionId);

    let suggestions: string[] = [];
    let currentPhase = "None";

    if (generations.length > 0) {
      currentPhase = "Complete";
      suggestions = [
        "🎉 Workflow complete! You can now run your generated export tool.",
        "💡 Use `search_exported_data` to query the captured data.",
        "🔄 Start a new session with `generate_session_id` for different data."
      ];
    } else if (discoveries.length > 0) {
      currentPhase = "Ready for Generation";
      suggestions = [
        "🛠️ Generate an export tool with `generate_export_tool`",
        "📝 Provide a detailed description for better code generation",
        "🎯 Choose the right language and output format for your needs"
      ];
    } else if (analyses.length > 0) {
      currentPhase = "Ready for Discovery";
      suggestions = [
        "🔍 Discover API patterns with `discover_api_patterns`",
        "⚙️ Adjust `minConfidence` if no patterns are found (try 0.3)",
        "🔐 Use `includeAuthInsights: true` for detailed auth analysis"
      ];
    } else if (captures.length > 0) {
      currentPhase = "Ready for Analysis";
      suggestions = [
        "📊 Analyze captured data with `analyze_captured_data`",
        "🎯 Set `includeStaticAssets: false` to focus on APIs only",
        "📋 Use `list_session_ids` to get your capture ID"
      ];
    } else {
      currentPhase = "Ready to Start";
      suggestions = [
        "🌐 Capture network traffic with `capture_network_requests`",
        "🆔 Use this sessionId: `" + sessionId + "`",
        "⏱️ Set appropriate `waitForNetworkIdleMs` for the target site",
        "🚫 Consider `ignoreStaticAssets: true` for API-focused analysis"
      ];
    }

    return {
      title: `Contextual Help for Session: ${sessionId}`,
      content: `
# Session Status: ${currentPhase}

**Session ID:** \`${sessionId}\`

## Current State
- **Captures:** ${captures.length} (${captures.filter(c => c.status === 'complete').length} complete)
- **Analyses:** ${analyses.length} (${analyses.filter(a => a.status === 'complete').length} complete)
- **Discoveries:** ${discoveries.length} (${discoveries.filter(d => d.status === 'complete').length} complete)
- **Generated Tools:** ${generations.length} (${generations.filter(g => g.status === 'complete').length} complete)

## 🎯 Next Steps

${suggestions.map(s => `- ${s}`).join('\n')}

## 📋 Available Commands

- \`list_session_ids\` - See all IDs for this session
- \`get_next_session_ids\` - Get IDs ready for next phase
- \`validate_id\` - Check if an ID is valid for this session
- \`get_workflow_chain\` - See complete workflow for any ID

## 💡 Quick Tips

${currentPhase === "Ready to Start" ? `
- Start with a simple website to test the workflow
- Make sure the site actually makes API calls (not just static content)
- Use browser dev tools to verify network activity first
` : currentPhase === "Ready for Analysis" ? `
- Check that your capture actually contains network requests
- Use \`search_exported_data\` to preview captured data
- Focus on API endpoints by excluding static assets
` : currentPhase === "Ready for Discovery" ? `
- Lower confidence threshold if no patterns found
- Ensure you captured diverse API interactions
- Check that endpoints follow RESTful patterns
` : currentPhase === "Ready for Generation" ? `
- Provide detailed descriptions for better code quality
- Choose appropriate language and output format
- Review discovered patterns before generating
` : `
- Test your generated tools on small datasets first
- Review and customize the code as needed
- Start a new session for different data sources
`}

## ❓ Need More Help?

- \`get_help\` - General overview and guidance
- \`get_help workflow\` - Detailed workflow explanation
- \`get_help tools\` - Complete tool reference
- \`get_help examples\` - Step-by-step examples
- \`get_help troubleshooting\` - Common issues and solutions
      `.trim()
    };
  }
}

/**
 * Get help tool handler
 */
export async function handleGetHelp(input: { topic?: string | null }) {
  const helpSystem = new HelpSystem();
  const topic = input.topic ?? undefined;
  const result = await helpSystem.getHelp(topic);

  if (Array.isArray(result)) {
    // Format workflow examples
    const examples = result as WorkflowExample[];
    const content = examples.map(example => 
      `## ${example.title}\n\n${example.description}\n\n` +
      example.steps.map(step => 
        `### Step ${step.step}: ${step.tool}\n` +
        `${step.description}\n\n` +
        (step.parameters ? `**Parameters:**\n\`\`\`json\n${JSON.stringify(step.parameters, null, 2)}\n\`\`\`\n\n` : '') +
        (step.example ? `**Example:** ${step.example}\n\n` : '')
      ).join('')
    ).join('\n---\n\n');

    return {
      content: [
        {
          type: 'text' as const,
          text: `# Workflow Examples\n\n${content}`
        }
      ]
    };
  } else {
    // Format help section
    const section = result as HelpSection;
    return {
      content: [
        {
          type: 'text' as const,
          text: section.content
        }
      ]
    };
  }
}

/**
 * Get contextual help based on session state
 */
export async function handleGetContextualHelp(input: { sessionId: string }) {
  const helpSystem = new HelpSystem();
  const result = await helpSystem.getContextualHelp(input.sessionId);

  return {
    content: [
      {
        type: 'text' as const,
        text: result.content
      }
    ]
  };
}

/**
 * Get quick start guide
 */
export async function handleGetQuickStart() {
  return {
    content: [
      {
        type: 'text' as const,
        text: `
# 🚀 Quick Start Guide

Get started with MCP Network Analyzer in 5 minutes:

## Step 1: Generate Session ID
\`\`\`
generate_session_id
\`\`\`

## Step 2: Capture Network Traffic  
\`\`\`
capture_network_requests {
  "url": "https://httpbin.org/json",
  "sessionId": "your-session-id-here",
  "waitForNetworkIdleMs": 3000
}
\`\`\`

## Step 3: List Your Data
\`\`\`
list_session_ids {
  "sessionId": "your-session-id-here" 
}
\`\`\`

## Step 4: Analyze the Capture
\`\`\`
analyze_captured_data {
  "captureId": "capture-id-from-step3"
}
\`\`\`

## Step 5: Get Next Steps
\`\`\`
get_contextual_help {
  "sessionId": "your-session-id-here"
}
\`\`\`

## 💡 Pro Tips

- **Start simple:** Use httpbin.org or similar test APIs first
- **Be patient:** Wait for network activity to complete
- **Stay secure:** Each session is private to you
- **Get help:** Use \`get_help\` with any topic for detailed guidance

## 🎯 Common First Targets

- **REST APIs:** https://jsonplaceholder.typicode.com
- **GraphQL:** https://api.github.com/graphql  
- **E-commerce:** Any online store (be respectful!)
- **Social Media:** Public APIs (check terms of service)

Ready to explore? Start with \`generate_session_id\`!
        `.trim()
      }
    ]
  };
}