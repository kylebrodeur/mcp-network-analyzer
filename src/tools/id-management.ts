/**
 * ID management tool - Generates and lists all available IDs for captures, analyses, and discoveries
 */

import { DatabaseService } from '../lib/database.js';
import { Storage } from '../lib/storage.js';

export interface IdListResult {
  captures: Array<{
    id: string;
    sessionId: string;
    targetUrl: string;
    status: string;
    requestCount: number;
    responseCount: number;
    timestamp: string;
  }>;
  analyses: Array<{
    id: string;
    captureId: string;
    status: string;
    totalRequests: number;
    totalResponses: number;
    apiEndpoints: number;
    timestamp: string;
  }>;
  discoveries: Array<{
    id: string;
    analysisId: string;
    status: string;
    patternsFound: number;
    paginationDetected: boolean;
    rateLimitingDetected: boolean;
    timestamp: string;
  }>;
  generations: Array<{
    id: string;
    discoveryId: string;
    toolName: string;
    language: string;
    status: string;
    timestamp: string;
  }>;
  summary: {
    totalCaptures: number;
    totalAnalyses: number;
    totalDiscoveries: number;
    totalGenerations: number;
    availableForAnalysis: number;
    availableForDiscovery: number;
    availableForGeneration: number;
  };
}

export class IdManager {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * List all available IDs across all phases for a specific session
   */
  public async listIdsForSession(sessionId: string): Promise<IdListResult> {
    await this.db.initialize();

    const captures = this.db.listCapturesBySession(sessionId);
    const analyses = this.db.listAnalysesBySession(sessionId);
    const discoveries = this.db.listDiscoveriesBySession(sessionId);
    const generations = this.db.listGenerationsBySession(sessionId);

    // Calculate availability for next phases within this session
    const capturesWithoutAnalysis = captures.filter(capture => 
      !analyses.some(analysis => analysis.captureId === capture.id)
    );

    const analysesWithoutDiscovery = analyses.filter(analysis =>
      analysis.status === 'complete' && 
      !discoveries.some(discovery => discovery.analysisId === analysis.id)
    );

    const discoveriesWithoutGeneration = discoveries.filter(discovery =>
      discovery.status === 'complete' &&
      !generations.some(generation => generation.discoveryId === discovery.id)
    );

    return {
      captures: captures.map(c => ({
        id: c.id,
        sessionId: c.sessionId,
        targetUrl: c.targetUrl,
        status: c.status,
        requestCount: c.requestCount,
        responseCount: c.responseCount,
        timestamp: c.timestamp
      })),
      analyses: analyses.map(a => ({
        id: a.id,
        captureId: a.captureId,
        status: a.status,
        totalRequests: a.totalRequests,
        totalResponses: a.totalResponses,
        apiEndpoints: a.apiEndpoints,
        timestamp: a.timestamp
      })),
      discoveries: discoveries.map(d => ({
        id: d.id,
        analysisId: d.analysisId,
        status: d.status,
        patternsFound: d.patternsFound,
        paginationDetected: d.paginationDetected,
        rateLimitingDetected: d.rateLimitingDetected,
        timestamp: d.timestamp
      })),
      generations: generations.map(g => ({
        id: g.id,
        discoveryId: g.discoveryId,
        toolName: g.toolName,
        language: g.language,
        status: g.status,
        timestamp: g.timestamp
      })),
      summary: {
        totalCaptures: captures.length,
        totalAnalyses: analyses.length,
        totalDiscoveries: discoveries.length,
        totalGenerations: generations.length,
        availableForAnalysis: capturesWithoutAnalysis.length,
        availableForDiscovery: analysesWithoutDiscovery.length,
        availableForGeneration: discoveriesWithoutGeneration.length
      }
    };
  }

  /**
   * List all available IDs across all phases (DEPRECATED - use listIdsForSession instead)
   * @deprecated This method exposes IDs across all sessions and should not be used in multi-user environments
   */
  public async listAllIds(): Promise<IdListResult> {
    await this.db.initialize();

    const captures = this.db.listCaptures();
    const analyses = this.db.listAnalyses();
    const discoveries = this.db.listDiscoveries();
    const generations = Object.values(this.db.getData()?.generations || {});

    // Calculate availability for next phases
    const capturesWithoutAnalysis = captures.filter(capture => 
      !analyses.some(analysis => analysis.captureId === capture.id)
    );

    const analysesWithoutDiscovery = analyses.filter(analysis =>
      analysis.status === 'complete' && 
      !discoveries.some(discovery => discovery.analysisId === analysis.id)
    );

    const discoveriesWithoutGeneration = discoveries.filter(discovery =>
      discovery.status === 'complete' &&
      !generations.some(generation => generation.discoveryId === discovery.id)
    );

    return {
      captures: captures.map(c => ({
        id: c.id,
        sessionId: c.sessionId,
        targetUrl: c.targetUrl,
        status: c.status,
        requestCount: c.requestCount,
        responseCount: c.responseCount,
        timestamp: c.timestamp
      })),
      analyses: analyses.map(a => ({
        id: a.id,
        captureId: a.captureId,
        status: a.status,
        totalRequests: a.totalRequests,
        totalResponses: a.totalResponses,
        apiEndpoints: a.apiEndpoints,
        timestamp: a.timestamp
      })),
      discoveries: discoveries.map(d => ({
        id: d.id,
        analysisId: d.analysisId,
        status: d.status,
        patternsFound: d.patternsFound,
        paginationDetected: d.paginationDetected,
        rateLimitingDetected: d.rateLimitingDetected,
        timestamp: d.timestamp
      })),
      generations: generations.map(g => ({
        id: g.id,
        discoveryId: g.discoveryId,
        toolName: g.toolName,
        language: g.language,
        status: g.status,
        timestamp: g.timestamp
      })),
      summary: {
        totalCaptures: captures.length,
        totalAnalyses: analyses.length,
        totalDiscoveries: discoveries.length,
        totalGenerations: generations.length,
        availableForAnalysis: capturesWithoutAnalysis.length,
        availableForDiscovery: analysesWithoutDiscovery.length,
        availableForGeneration: discoveriesWithoutGeneration.length
      }
    };
  }

  /**
   * Get next available IDs for workflow progression within a specific session
   */
  public async getNextAvailableIdsForSession(sessionId: string): Promise<{
    capturesReadyForAnalysis: string[];
    analysesReadyForDiscovery: string[];
    discoveriesReadyForGeneration: string[];
    suggestedNextAction?: string;
  }> {
    const result = await this.listIdsForSession(sessionId);

    const capturesReadyForAnalysis = result.captures
      .filter(c => c.status === 'complete')
      .filter(c => !result.analyses.some(a => a.captureId === c.id))
      .map(c => c.id);

    const analysesReadyForDiscovery = result.analyses
      .filter(a => a.status === 'complete')
      .filter(a => !result.discoveries.some(d => d.analysisId === a.id))
      .map(a => a.id);

    const discoveriesReadyForGeneration = result.discoveries
      .filter(d => d.status === 'complete')
      .filter(d => !result.generations.some(g => g.discoveryId === d.id))
      .map(d => d.id);

    let suggestedNextAction: string | undefined;
    
    if (capturesReadyForAnalysis.length > 0) {
      suggestedNextAction = `Run analyze_captured_data with captureId: ${capturesReadyForAnalysis[0]}`;
    } else if (analysesReadyForDiscovery.length > 0) {
      suggestedNextAction = `Run discover_api_patterns with analysisId: ${analysesReadyForDiscovery[0]}`;
    } else if (discoveriesReadyForGeneration.length > 0) {
      suggestedNextAction = `Run generate_export_tool with discoveryId: ${discoveriesReadyForGeneration[0]}`;
    } else if (result.summary.totalCaptures === 0) {
      suggestedNextAction = `Start by running capture_network_requests with sessionId: ${sessionId}`;
    }

    return {
      capturesReadyForAnalysis,
      analysesReadyForDiscovery,
      discoveriesReadyForGeneration,
      suggestedNextAction
    };
  }

  /**
   * Get next available IDs for workflow progression (DEPRECATED - use getNextAvailableIdsForSession instead)
   * @deprecated This method exposes IDs across all sessions and should not be used in multi-user environments
   */
  public async getNextAvailableIds(): Promise<{
    capturesReadyForAnalysis: string[];
    analysesReadyForDiscovery: string[];
    discoveriesReadyForGeneration: string[];
    suggestedNextAction?: string;
  }> {
    const result = await this.listAllIds();

    const capturesReadyForAnalysis = result.captures
      .filter(c => c.status === 'complete')
      .filter(c => !result.analyses.some(a => a.captureId === c.id))
      .map(c => c.id);

    const analysesReadyForDiscovery = result.analyses
      .filter(a => a.status === 'complete')
      .filter(a => !result.discoveries.some(d => d.analysisId === a.id))
      .map(a => a.id);

    const discoveriesReadyForGeneration = result.discoveries
      .filter(d => d.status === 'complete')
      .filter(d => !result.generations.some(g => g.discoveryId === d.id))
      .map(d => d.id);

    let suggestedNextAction: string | undefined;
    
    if (capturesReadyForAnalysis.length > 0) {
      suggestedNextAction = `Run analyze_captured_data with captureId: ${capturesReadyForAnalysis[0]}`;
    } else if (analysesReadyForDiscovery.length > 0) {
      suggestedNextAction = `Run discover_api_patterns with analysisId: ${analysesReadyForDiscovery[0]}`;
    } else if (discoveriesReadyForGeneration.length > 0) {
      suggestedNextAction = `Run generate_export_tool with discoveryId: ${discoveriesReadyForGeneration[0]}`;
    } else if (result.summary.totalCaptures === 0) {
      suggestedNextAction = 'Start by running capture_network_requests to capture some traffic';
    }

    return {
      capturesReadyForAnalysis,
      analysesReadyForDiscovery,
      discoveriesReadyForGeneration,
      suggestedNextAction
    };
  }

  /**
   * Validate that an ID belongs to the specified session
   */
  public async validateSessionAccess(id: string, sessionId: string): Promise<boolean> {
    await this.db.initialize();
    return this.db.validateSessionAccess(id, sessionId);
  }

  /**
   * Generate a new session ID for capture
   */
  public generateCaptureSessionId(): string {
    return Storage.generateSessionId();
  }

  /**
   * Validate if an ID exists and is in the correct state, with optional session validation
   */
  public async validateId(
    id: string, 
    expectedType: 'capture' | 'analysis' | 'discovery' | 'generation',
    sessionId?: string
  ): Promise<{
    valid: boolean;
    exists: boolean;
    correctType: boolean;
    sessionValid?: boolean;
    status?: string;
    error?: string;
  }> {
    await this.db.initialize();

    try {
      let exists = false;
      let correctType = false;
      let status: string | undefined;

      switch (expectedType) {
        case 'capture': {
          const capture = this.db.getCapture(id);
          exists = !!capture;
          correctType = !!capture;
          status = capture?.status;
          break;
        }
        
        case 'analysis': {
          const analysis = this.db.getAnalysis(id);
          exists = !!analysis;
          correctType = !!analysis;
          status = analysis?.status;
          break;
        }
        
        case 'discovery': {
          const discovery = this.db.getDiscovery(id);
          exists = !!discovery;
          correctType = !!discovery;
          status = discovery?.status;
          break;
        }
        
        case 'generation': {
          const generations = this.db.getData()?.generations || {};
          const generation = generations[id];
          exists = !!generation;
          correctType = !!generation;
          status = generation?.status;
          break;
        }
        
        default:
          return {
            valid: false,
            exists: false,
            correctType: false,
            error: `Unknown ID type: ${expectedType}`
          };
      }

      // Validate session access if sessionId is provided
      let sessionValid: boolean | undefined;
      if (sessionId && exists) {
        sessionValid = this.db.validateSessionAccess(id, sessionId);
        if (!sessionValid) {
          return {
            valid: false,
            exists,
            correctType,
            sessionValid,
            status,
            error: `ID ${id} does not belong to session ${sessionId}`
          };
        }
      }

      return {
        valid: exists && correctType && (sessionValid !== false),
        exists,
        correctType,
        sessionValid,
        status
      };
    } catch (error) {
      return {
        valid: false,
        exists: false,
        correctType: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get the full workflow chain for a given ID
   */
  public async getWorkflowChain(startId: string): Promise<{
    capture?: any;
    analysis?: any;
    discovery?: any;
    generation?: any;
    chain: string[];
    nextStep?: string;
  }> {
    await this.db.initialize();

    let capture: any;
    let analysis: any;
    let discovery: any;
    let generation: any;
    const chain: string[] = [];

    // Try to find the starting point
    capture = this.db.getCapture(startId);
    if (capture) {
      chain.push(`capture:${capture.id}`);
      
      // Find related analysis
      const analyses = this.db.getAnalysesByCapture(capture.id);
      if (analyses.length > 0) {
        analysis = analyses[0];
        chain.push(`analysis:${analysis.id}`);
        
        // Find related discovery
        const discoveries = this.db.getDiscoveriesByAnalysis(analysis.id);
        if (discoveries.length > 0) {
          discovery = discoveries[0];
          chain.push(`discovery:${discovery.id}`);
          
          // Find related generation
          const generations = this.db.getGenerationsByDiscovery(discovery.id);
          if (generations.length > 0) {
            generation = generations[0];
            chain.push(`generation:${generation.id}`);
          }
        }
      }
    } else {
      // Try analysis
      analysis = this.db.getAnalysis(startId);
      if (analysis) {
        const captureRecord = this.db.getCapture(analysis.captureId);
        if (captureRecord) {
          capture = captureRecord;
          chain.push(`capture:${capture.id}`);
        }
        chain.push(`analysis:${analysis.id}`);
        
        const discoveries = this.db.getDiscoveriesByAnalysis(analysis.id);
        if (discoveries.length > 0) {
          discovery = discoveries[0];
          chain.push(`discovery:${discovery.id}`);
          
          const generations = this.db.getGenerationsByDiscovery(discovery.id);
          if (generations.length > 0) {
            generation = generations[0];
            chain.push(`generation:${generation.id}`);
          }
        }
      } else {
        // Try discovery
        discovery = this.db.getDiscovery(startId);
        if (discovery) {
          analysis = this.db.getAnalysis(discovery.analysisId);
          if (analysis) {
            const captureRecord = this.db.getCapture(analysis.captureId);
            if (captureRecord) {
              capture = captureRecord;
              chain.push(`capture:${capture.id}`);
            }
            chain.push(`analysis:${analysis.id}`);
          }
          chain.push(`discovery:${discovery.id}`);
          
          const generations = this.db.getGenerationsByDiscovery(discovery.id);
          if (generations.length > 0) {
            generation = generations[0];
            chain.push(`generation:${generation.id}`);
          }
        }
      }
    }

    // Determine next step
    let nextStep: string | undefined;
    if (capture && !analysis) {
      nextStep = `Run analyze_captured_data with captureId: ${capture.id}`;
    } else if (analysis && analysis.status === 'complete' && !discovery) {
      nextStep = `Run discover_api_patterns with analysisId: ${analysis.id}`;
    } else if (discovery && discovery.status === 'complete' && !generation) {
      nextStep = `Run generate_export_tool with discoveryId: ${discovery.id}`;
    }

    return {
      capture,
      analysis,
      discovery,
      generation,
      chain,
      nextStep
    };
  }
}

/**
 * List available IDs for a specific session tool handler
 */
export async function handleListSessionIds(input: { sessionId: string }) {
  const idManager = new IdManager();
  const result = await idManager.listIdsForSession(input.sessionId);

  return {
    content: [
      {
        type: 'text' as const,
        text: formatIdList(result, input.sessionId)
      }
    ]
  };
}

/**
 * List all available IDs tool handler (DEPRECATED)
 * @deprecated Use handleListSessionIds instead for security
 */
export async function handleListAllIds() {
  console.warn('SECURITY WARNING: listAllIds is deprecated and exposes IDs across all sessions');
  const idManager = new IdManager();
  const result = await idManager.listAllIds();

  return {
    content: [
      {
        type: 'text' as const,
        text: `⚠️  **SECURITY WARNING**: This tool is deprecated and shows IDs from all sessions.\n\n` +
             `Please use 'list_session_ids' instead with a specific sessionId for security.\n\n` +
             formatIdList(result)
      }
    ]
  };
}

/**
 * Get next available IDs for a specific session tool handler
 */
export async function handleGetNextSessionIds(input: { sessionId: string }) {
  const idManager = new IdManager();
  const result = await idManager.getNextAvailableIdsForSession(input.sessionId);

  return {
    content: [
      {
        type: 'text' as const,
        text: formatNextIds(result, input.sessionId)
      }
    ]
  };
}

/**
 * Get next available IDs tool handler (DEPRECATED)
 * @deprecated Use handleGetNextSessionIds instead for security
 */
export async function handleGetNextIds() {
  console.warn('SECURITY WARNING: getNextIds is deprecated and exposes IDs across all sessions');
  const idManager = new IdManager();
  const result = await idManager.getNextAvailableIds();

  return {
    content: [
      {
        type: 'text' as const,
        text: `⚠️  **SECURITY WARNING**: This tool is deprecated and shows IDs from all sessions.\n\n` +
             `Please use 'get_next_session_ids' instead with a specific sessionId for security.\n\n` +
             formatNextIds(result)
      }
    ]
  };
}

/**
 * Generate new capture session ID tool handler
 */
export async function handleGenerateSessionId() {
  const idManager = new IdManager();
  const sessionId = idManager.generateCaptureSessionId();

  return {
    content: [
      {
        type: 'text' as const,
        text: `Generated new session ID: \`${sessionId}\`\n\nUse this ID when running capture_network_requests with the sessionId parameter.`
      }
    ]
  };
}

/**
 * Validate ID tool handler with optional session validation
 */
export async function handleValidateId(input: { 
  id: string; 
  type: 'capture' | 'analysis' | 'discovery' | 'generation';
  sessionId?: string;
}) {
  const idManager = new IdManager();
  const result = await idManager.validateId(input.id, input.type, input.sessionId);

  let statusMessage = '';
  if (result.valid) {
    statusMessage = `✅ Valid ${input.type} ID: \`${input.id}\` (Status: ${result.status})`;
    if (input.sessionId && result.sessionValid) {
      statusMessage += ` - Session validated`;
    }
  } else if (!result.exists) {
    statusMessage = `❌ ID \`${input.id}\` does not exist as a ${input.type}`;
  } else if (!result.correctType) {
    statusMessage = `❌ ID \`${input.id}\` exists but is not a ${input.type}`;
  } else if (result.sessionValid === false) {
    statusMessage = `❌ ID \`${input.id}\` does not belong to session \`${input.sessionId}\``;
  } else {
    statusMessage = `❌ ID validation failed: ${result.error}`;
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: statusMessage
      }
    ]
  };
}

export async function handleGetWorkflowChain(input: { id: string; sessionId?: string }) {
  const idManager = new IdManager();
  
  // Validate session access if sessionId is provided
  if (input.sessionId) {
    const sessionValid = await idManager.validateSessionAccess(input.id, input.sessionId);
    if (!sessionValid) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `❌ ID \`${input.id}\` does not belong to session \`${input.sessionId}\``
          }
        ]
      };
    }
  }
  
  const result = await idManager.getWorkflowChain(input.id);

  return {
    content: [
      {
        type: 'text' as const,
        text: formatWorkflowChain(result)
      }
    ]
  };
}

/**
 * Format ID list for display
 */
function formatIdList(result: IdListResult, sessionId?: string): string {
  let output = sessionId 
    ? `# Available IDs for Session: ${sessionId}\n\n`
    : `# All Available IDs\n\n`;

  // Summary
  output += `## Summary\n\n`;
  output += `- **Captures:** ${result.summary.totalCaptures} total\n`;
  output += `- **Analyses:** ${result.summary.totalAnalyses} total\n`;
  output += `- **Discoveries:** ${result.summary.totalDiscoveries} total\n`;
  output += `- **Generations:** ${result.summary.totalGenerations} total\n\n`;

  output += `### Ready for Next Phase\n`;
  output += `- **Ready for Analysis:** ${result.summary.availableForAnalysis} captures\n`;
  output += `- **Ready for Discovery:** ${result.summary.availableForDiscovery} analyses\n`;
  output += `- **Ready for Generation:** ${result.summary.availableForGeneration} discoveries\n\n`;

  // Captures
  if (result.captures.length > 0) {
    output += `## Captures (${result.captures.length})\n\n`;
    for (const capture of result.captures) {
      output += `### ${capture.id}\n`;
      output += `- **Session:** ${capture.sessionId}\n`;
      output += `- **URL:** ${capture.targetUrl}\n`;
      output += `- **Status:** ${capture.status}\n`;
      output += `- **Requests/Responses:** ${capture.requestCount}/${capture.responseCount}\n`;
      output += `- **Timestamp:** ${new Date(capture.timestamp).toISOString()}\n\n`;
    }
  }

  // Analyses
  if (result.analyses.length > 0) {
    output += `## Analyses (${result.analyses.length})\n\n`;
    for (const analysis of result.analyses) {
      output += `### ${analysis.id}\n`;
      output += `- **Capture ID:** ${analysis.captureId}\n`;
      output += `- **Status:** ${analysis.status}\n`;
      output += `- **Requests/Responses:** ${analysis.totalRequests}/${analysis.totalResponses}\n`;
      output += `- **API Endpoints:** ${analysis.apiEndpoints}\n`;
      output += `- **Timestamp:** ${new Date(analysis.timestamp).toISOString()}\n\n`;
    }
  }

  // Discoveries
  if (result.discoveries.length > 0) {
    output += `## Discoveries (${result.discoveries.length})\n\n`;
    for (const discovery of result.discoveries) {
      output += `### ${discovery.id}\n`;
      output += `- **Analysis ID:** ${discovery.analysisId}\n`;
      output += `- **Status:** ${discovery.status}\n`;
      output += `- **Patterns Found:** ${discovery.patternsFound}\n`;
      output += `- **Pagination Detected:** ${discovery.paginationDetected ? 'Yes' : 'No'}\n`;
      output += `- **Rate Limiting Detected:** ${discovery.rateLimitingDetected ? 'Yes' : 'No'}\n`;
      output += `- **Timestamp:** ${new Date(discovery.timestamp).toISOString()}\n\n`;
    }
  }

  // Generations
  if (result.generations.length > 0) {
    output += `## Generations (${result.generations.length})\n\n`;
    for (const generation of result.generations) {
      output += `### ${generation.id}\n`;
      output += `- **Discovery ID:** ${generation.discoveryId}\n`;
      output += `- **Tool Name:** ${generation.toolName}\n`;
      output += `- **Language:** ${generation.language}\n`;
      output += `- **Status:** ${generation.status}\n`;
      output += `- **Timestamp:** ${new Date(generation.timestamp).toISOString()}\n\n`;
    }
  }

  return output;
}

/**
 * Format next available IDs for display
 */
function formatNextIds(result: {
  capturesReadyForAnalysis: string[];
  analysesReadyForDiscovery: string[];
  discoveriesReadyForGeneration: string[];
  suggestedNextAction?: string;
}, sessionId?: string): string {
  let output = sessionId 
    ? `# Next Available IDs for Session: ${sessionId}\n\n`
    : `# Next Available IDs\n\n`;

  if (result.suggestedNextAction) {
    output += `## 🎯 Suggested Next Action\n\n`;
    output += `**${result.suggestedNextAction}**\n\n`;
  }

  output += `## Ready for Analysis (${result.capturesReadyForAnalysis.length})\n\n`;
  if (result.capturesReadyForAnalysis.length > 0) {
    for (const captureId of result.capturesReadyForAnalysis) {
      output += `- \`${captureId}\` - Run: \`analyze_captured_data\`\n`;
    }
  } else {
    output += `No captures ready for analysis.\n`;
  }
  output += `\n`;

  output += `## Ready for Discovery (${result.analysesReadyForDiscovery.length})\n\n`;
  if (result.analysesReadyForDiscovery.length > 0) {
    for (const analysisId of result.analysesReadyForDiscovery) {
      output += `- \`${analysisId}\` - Run: \`discover_api_patterns\`\n`;
    }
  } else {
    output += `No analyses ready for discovery.\n`;
  }
  output += `\n`;

  output += `## Ready for Generation (${result.discoveriesReadyForGeneration.length})\n\n`;
  if (result.discoveriesReadyForGeneration.length > 0) {
    for (const discoveryId of result.discoveriesReadyForGeneration) {
      output += `- \`${discoveryId}\` - Run: \`generate_export_tool\`\n`;
    }
  } else {
    output += `No discoveries ready for generation.\n`;
  }

  return output;
}

/**
 * Format workflow chain for display
 */
function formatWorkflowChain(result: {
  capture?: any;
  analysis?: any;
  discovery?: any;
  generation?: any;
  chain: string[];
  nextStep?: string;
}): string {
  let output = `# Workflow Chain\n\n`;

  if (result.chain.length === 0) {
    output += `No workflow found for the provided ID.\n`;
    return output;
  }

  output += `## Chain Overview\n\n`;
  output += result.chain.map((item, index) => {
    const [type, id] = item.split(':');
    const arrow = index < result.chain.length - 1 ? ' → ' : '';
    return `**${type.charAt(0).toUpperCase() + type.slice(1)}** (\`${id}\`)${arrow}`;
  }).join('') + '\n\n';

  if (result.nextStep) {
    output += `## 🎯 Next Step\n\n`;
    output += `**${result.nextStep}**\n\n`;
  }

  // Detailed information
  if (result.capture) {
    output += `## Capture Details\n\n`;
    output += `- **ID:** ${result.capture.id}\n`;
    output += `- **Session:** ${result.capture.sessionId}\n`;
    output += `- **URL:** ${result.capture.targetUrl}\n`;
    output += `- **Status:** ${result.capture.status}\n`;
    output += `- **Requests/Responses:** ${result.capture.requestCount}/${result.capture.responseCount}\n\n`;
  }

  if (result.analysis) {
    output += `## Analysis Details\n\n`;
    output += `- **ID:** ${result.analysis.id}\n`;
    output += `- **Status:** ${result.analysis.status}\n`;
    output += `- **Total Requests/Responses:** ${result.analysis.totalRequests}/${result.analysis.totalResponses}\n`;
    output += `- **API Endpoints:** ${result.analysis.apiEndpoints}\n\n`;
  }

  if (result.discovery) {
    output += `## Discovery Details\n\n`;
    output += `- **ID:** ${result.discovery.id}\n`;
    output += `- **Status:** ${result.discovery.status}\n`;
    output += `- **Patterns Found:** ${result.discovery.patternsFound}\n`;
    output += `- **Features:** `;
    const features = [];
    if (result.discovery.paginationDetected) features.push('Pagination');
    if (result.discovery.rateLimitingDetected) features.push('Rate Limiting');
    output += features.length > 0 ? features.join(', ') : 'None detected';
    output += `\n\n`;
  }

  if (result.generation) {
    output += `## Generation Details\n\n`;
    output += `- **ID:** ${result.generation.id}\n`;
    output += `- **Tool Name:** ${result.generation.toolName}\n`;
    output += `- **Language:** ${result.generation.language}\n`;
    output += `- **Status:** ${result.generation.status}\n\n`;
  }

  return output;
}