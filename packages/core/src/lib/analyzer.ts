/**
 * Basic network request analyzer
 * Groups and categorizes captured requests for analysis
 */

import { CapturedRequest, CapturedResponse, CaptureSession } from "./types.js";

export interface EndpointGroup {
  pathPattern: string;
  method: string;
  count: number;
  urls: string[];
  statusCodes: number[];
  avgResponseTime?: number;
}

export interface AuthInfo {
  method: "cookie" | "bearer" | "apikey" | "basic" | "custom" | "none";
  headers: Record<string, string>;
  cookies?: string[];
  confidence: number;
}

export interface AnalysisSummary {
  captureId: string;
  timestamp: string;
  summary: {
    totalRequests: number;
    totalResponses: number;
    domains: string[];
    apiEndpoints: number;
    staticAssets: number;
    errorCount: number;
  };
  endpointGroups: EndpointGroup[];
  authInfo: AuthInfo;
  contentTypes: Record<string, number>;
  statusCodeDistribution: Record<number, number>;
}

/**
 * Analyze captured network data and extract insights
 */
export class NetworkAnalyzer {
  /**
   * Perform basic analysis on captured session data
   */
  async analyze(session: CaptureSession): Promise<AnalysisSummary> {
    const requestMap = new Map<string, CapturedRequest>();
    session.requests.forEach((req) => requestMap.set(req.id, req));

    // Group endpoints by path pattern
    const endpointGroups = this.groupEndpoints(session.requests);

    // Analyze authentication
    const authInfo = this.detectAuthMethod(session.requests);

    // Analyze content types
    const contentTypes = this.analyzeContentTypes(session.responses);

    // Analyze status codes
    const statusCodeDistribution = this.analyzeStatusCodes(session.responses);

    // Count API endpoints vs static assets
    const apiEndpoints = session.requests.filter((req) =>
      this.isApiRequest(req)
    ).length;
    const staticAssets = session.requests.length - apiEndpoints;

    // Count errors (4xx, 5xx)
    const errorCount = session.responses.filter(
      (res) => res.status >= 400
    ).length;

    return {
      captureId: session.id,
      timestamp: new Date().toISOString(),
      summary: {
        totalRequests: session.requests.length,
        totalResponses: session.responses.length,
        domains: session.metadata.domains,
        apiEndpoints,
        staticAssets,
        errorCount,
      },
      endpointGroups,
      authInfo,
      contentTypes,
      statusCodeDistribution,
    };
  }

  /**
   * Group requests by path pattern
   */
  private groupEndpoints(requests: CapturedRequest[]): EndpointGroup[] {
    const groups = new Map<string, EndpointGroup>();

    for (const req of requests) {
      if (!this.isApiRequest(req)) continue;

      const url = new URL(req.url);
      const pathPattern = this.extractPathPattern(url.pathname);
      const key = `${req.method}:${pathPattern}`;

      if (!groups.has(key)) {
        groups.set(key, {
          pathPattern,
          method: req.method,
          count: 0,
          urls: [],
          statusCodes: [],
        });
      }

      const group = groups.get(key)!;
      group.count++;
      group.urls.push(req.url);
    }

    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Detect authentication method from requests
   */
  private detectAuthMethod(requests: CapturedRequest[]): AuthInfo {
    const authHeaders: Record<string, string> = {};
    const cookies = new Set<string>();
    let detectedMethod: AuthInfo["method"] = "none";
    let confidence = 0;

    for (const req of requests) {
      // Check Authorization header
      if (req.headers["authorization"] || req.headers["Authorization"]) {
        const authValue =
          req.headers["authorization"] || req.headers["Authorization"];
        authHeaders["Authorization"] = authValue;

        if (authValue.toLowerCase().startsWith("bearer ")) {
          detectedMethod = "bearer";
          confidence = 0.9;
        } else if (authValue.toLowerCase().startsWith("basic ")) {
          detectedMethod = "basic";
          confidence = 0.9;
        }
      }

      // Check API key headers
      if (req.headers["x-api-key"] || req.headers["X-Api-Key"]) {
        authHeaders["X-Api-Key"] =
          req.headers["x-api-key"] || req.headers["X-Api-Key"];
        detectedMethod = "apikey";
        confidence = 0.85;
      }

      // Check for cookies
      if (req.headers["cookie"] || req.headers["Cookie"]) {
        const cookieValue = req.headers["cookie"] || req.headers["Cookie"];
        cookieValue.split(";").forEach((c) => cookies.add(c.trim()));

        if (detectedMethod === "none") {
          detectedMethod = "cookie";
          confidence = 0.7;
        }
      }

      // Check for custom auth headers
      for (const [key, value] of Object.entries(req.headers)) {
        if (
          key.toLowerCase().includes("auth") ||
          key.toLowerCase().includes("token")
        ) {
          authHeaders[key] = value;
          if (detectedMethod === "none") {
            detectedMethod = "custom";
            confidence = 0.6;
          }
        }
      }
    }

    return {
      method: detectedMethod,
      headers: authHeaders,
      cookies: Array.from(cookies),
      confidence,
    };
  }

  /**
   * Analyze content types from responses
   */
  private analyzeContentTypes(
    responses: CapturedResponse[]
  ): Record<string, number> {
    const contentTypes: Record<string, number> = {};

    for (const res of responses) {
      const contentType =
        res.mimeType ||
        res.headers["content-type"] ||
        res.headers["Content-Type"] ||
        "unknown";

      // Simplify content type (remove charset, etc.)
      const simpleType = contentType.split(";")[0].trim();

      contentTypes[simpleType] = (contentTypes[simpleType] || 0) + 1;
    }

    return contentTypes;
  }

  /**
   * Analyze status code distribution
   */
  private analyzeStatusCodes(
    responses: CapturedResponse[]
  ): Record<number, number> {
    const statusCodes: Record<number, number> = {};

    for (const res of responses) {
      statusCodes[res.status] = (statusCodes[res.status] || 0) + 1;
    }

    return statusCodes;
  }

  /**
   * Check if request is an API call (vs static asset)
   */
  private isApiRequest(req: CapturedRequest): boolean {
    const apiTypes = ["xhr", "fetch"];
    if (apiTypes.includes(req.resourceType.toLowerCase())) {
      return true;
    }

    // Check URL patterns that indicate API calls
    const url = req.url.toLowerCase();
    return (
      url.includes("/api/") ||
      url.includes("/v1/") ||
      url.includes("/v2/") ||
      url.includes("/graphql") ||
      url.endsWith(".json")
    );
  }

  /**
   * Extract path pattern from URL path
   * Converts numeric IDs and UUIDs to placeholders
   */
  private extractPathPattern(path: string): string {
    return path
      .split("/")
      .map((segment) => {
        // Replace numeric IDs
        if (/^\d+$/.test(segment)) {
          return ":id";
        }
        // Replace UUIDs
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            segment
          )
        ) {
          return ":uuid";
        }
        // Replace other hex strings that look like IDs
        if (/^[0-9a-f]{16,}$/i.test(segment)) {
          return ":hash";
        }
        return segment;
      })
      .join("/");
  }

  /**
   * Generate suggested next steps based on analysis
   */
  generateSuggestions(summary: AnalysisSummary): string[] {
    const suggestions: string[] = [];

    // Suggest based on endpoint patterns
    const restEndpoints = summary.endpointGroups.filter(g => 
      g.pathPattern.includes(':id') || g.pathPattern.includes(':uuid')
    );
    
    if (restEndpoints.length > 0) {
      suggestions.push(
        `Discovered ${restEndpoints.length} REST-like endpoints - run discover_api_patterns for detailed analysis`
      );
    }

    // Suggest based on authentication
    if (summary.authInfo.method !== 'none') {
      suggestions.push(
        `Authentication detected (${summary.authInfo.method}) - export script will include auth handling`
      );
    } else {
      suggestions.push('No authentication detected - API may be public or require setup');
    }

    // Suggest based on endpoint count
    if (summary.endpointGroups.length > 10) {
      suggestions.push('Large API surface detected - consider focusing on specific endpoints');
    } else if (summary.endpointGroups.length > 0) {
      suggestions.push('Endpoint groups are ready for downstream extraction planning and manual implementation');
    }

    // Suggest based on errors
    if (summary.summary.errorCount > 0) {
      suggestions.push(
        `${summary.summary.errorCount} errors detected - review authentication or endpoint access`
      );
    }

    return suggestions;
  }
}
