/**
 * Network analysis tool implementation
 * Analyzes captured network data to extract insights and patterns
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AnalysisSummary, NetworkAnalyzer } from "../lib/analyzer.js";
import { DatabaseService } from "../lib/database.js";
import { Storage } from "../lib/storage.js";
import type { CaptureSession } from "../lib/types.js";

export interface AnalyzeOptions {
  captureId: string;
  includeStaticAssets?: boolean;
  outputPath?: string;
}

export interface AnalyzeResult {
  success: boolean;
  analysisId: string;
  analysisPath?: string;
  summary: {
    totalRequests: number;
    totalResponses: number;
    domains: string[];
    apiEndpoints: number;
    staticAssets: number;
    errorCount: number;
  };
  endpointGroups: Array<{
    pathPattern: string;
    method: string;
    count: number;
    exampleUrl: string;
  }>;
  authentication: {
    method: string;
    confidence: number;
    headers: string[];
    hasCookies: boolean;
  };
  contentTypes: Record<string, number>;
  statusCodes: Record<string, number>;
  recommendations: string[];
  error?: string;
}

/**
 * Analyze captured network data
 */
export async function analyzeCapturedData(
  options: AnalyzeOptions
): Promise<AnalyzeResult> {
  const db = DatabaseService.getInstance();
  let analysisId: string | null = null;
  
  try {
    // Generate analysis ID first
    analysisId = await db.createAnalysis(options.captureId);
    
    // Get capture record to find the sessionId
    const captureRecord = db.getCapture(options.captureId);
    if (!captureRecord) {
      throw new Error(`Capture ID ${options.captureId} not found`);
    }
    
    // Load the capture session using sessionId (not captureId)
    const sessionPath = Storage.getSessionPath(captureRecord.sessionId);
    const sessionFile = join(sessionPath, "session.json");

    const sessionData = await readFile(sessionFile, "utf-8");
    const session: CaptureSession = JSON.parse(sessionData);

    // Perform analysis
    const analyzer = new NetworkAnalyzer();
    const analysis: AnalysisSummary = await analyzer.analyze(session);

    // Save analysis results
    const dataDir = Storage.getDataDirectory();
    const analysisPath = join(dataDir, "analyses", analysisId);
    await mkdir(analysisPath, { recursive: true });

    const analysisFile = join(analysisPath, "analysis.json");
    await writeFile(analysisFile, JSON.stringify(analysis, null, 2), "utf-8");

    // Update database record with results
    await db.updateAnalysis(analysisId, {
      status: 'complete',
      filePath: analysisFile,
      totalRequests: analysis.summary.totalRequests,
      totalResponses: analysis.summary.totalResponses,
      apiEndpoints: analysis.summary.apiEndpoints,
      staticAssets: analysis.summary.staticAssets,
      errorCount: analysis.summary.errorCount
    });

    // Generate recommendations
    const recommendations = generateRecommendations(analysis, analysisId);

    // Format result for MCP response
    return {
      success: true,
      analysisId,
      analysisPath,
      summary: analysis.summary,
      endpointGroups: analysis.endpointGroups.map((group) => ({
        pathPattern: group.pathPattern,
        method: group.method,
        count: group.count,
        exampleUrl: group.urls[0] || "",
      })),
      authentication: {
        method: analysis.authInfo.method,
        confidence: analysis.authInfo.confidence,
        headers: Object.keys(analysis.authInfo.headers),
        hasCookies: (analysis.authInfo.cookies?.length || 0) > 0,
      },
      contentTypes: analysis.contentTypes,
      statusCodes: analysis.statusCodeDistribution,
      recommendations,
    };
  } catch (error) {
    // Update database record if we have an analysis ID
    if (analysisId) {
      await db.updateAnalysis(analysisId, { status: 'failed' });
    }
    
    return {
      success: false,
      analysisId: analysisId || "",
      summary: {
        totalRequests: 0,
        totalResponses: 0,
        domains: [],
        apiEndpoints: 0,
        staticAssets: 0,
        errorCount: 0,
      },
      endpointGroups: [],
      authentication: {
        method: "none",
        confidence: 0,
        headers: [],
        hasCookies: false,
      },
      contentTypes: {},
      statusCodes: {},
      recommendations: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(analysis: AnalysisSummary, analysisId: string): string[] {
  const recommendations: string[] = [];

  // Authentication recommendations
  if (analysis.authInfo.method !== "none") {
    recommendations.push(
      `Authentication detected: ${analysis.authInfo.method} (confidence: ${Math.round(analysis.authInfo.confidence * 100)}%). Make sure to include these headers in generated export tools.`
    );
  } else {
    recommendations.push(
      "No authentication detected. The API may be public or require manual authentication."
    );
  }

  // API endpoint recommendations
  if (analysis.summary.apiEndpoints > 0) {
    recommendations.push(
      `Found ${analysis.summary.apiEndpoints} API endpoints. Run discover_api_patterns to identify REST patterns and data models.`
    );
  }

  // Error handling recommendations
  if (analysis.summary.errorCount > 0) {
    const errorRate =
      (analysis.summary.errorCount / analysis.summary.totalResponses) * 100;
    recommendations.push(
      `${analysis.summary.errorCount} requests failed (${errorRate.toFixed(1)}% error rate). Review error responses for rate limiting or authentication issues.`
    );
  }

  // Content type recommendations
  const jsonEndpoints = analysis.contentTypes["application/json"] || 0;
  if (jsonEndpoints > 0) {
    recommendations.push(
      `${jsonEndpoints} JSON responses detected. Good candidate for structured data export.`
    );
  }

  // Pagination hints
  const listEndpoints = analysis.endpointGroups.filter((g) =>
    g.pathPattern.includes("/api/")
  );
  if (listEndpoints.length > 0) {
    recommendations.push(
      `${listEndpoints.length} potential list endpoints found. Check for pagination patterns (page, offset, cursor parameters).`
    );
  }

  // Next steps
  if (analysis.summary.apiEndpoints > 5) {
    recommendations.push(
      "Complex API detected. Consider using discover_api_patterns for deeper analysis before generating export tools."
    );
  } else if (analysis.summary.apiEndpoints > 0) {
    recommendations.push(
      "Simple API detected. You may proceed directly to generate_export_tool if patterns are clear."
    );
  }

  // Always add the analysis ID for next steps
  recommendations.push(`✅ Analysis Complete! Use this ID for next steps:`);
  recommendations.push(`📋 Analysis ID: ${analysisId}`);
  recommendations.push(`🔍 Next: Run discover_api_patterns with analysisId: ${analysisId}`);
  recommendations.push(`📊 Or use 'get_next_available_ids' to see all available IDs`);

  return recommendations;
}
