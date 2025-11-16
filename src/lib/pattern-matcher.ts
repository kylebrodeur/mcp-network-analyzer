/**
 * Advanced API pattern recognition and data model inference
 */

import type { CapturedRequest, CapturedResponse } from "./types.js";

export type APIPatternType =
  | "list"
  | "detail"
  | "create"
  | "update"
  | "delete"
  | "search";

export interface APIPattern {
  type: APIPatternType;
  method: string;
  pathPattern: string;
  pathParams?: string[];
  queryParams?: string[];
  authMethod: "cookie" | "bearer" | "apikey" | "basic" | "custom" | "none";
  requiredHeaders: Record<string, string>;
  responseType: "array" | "object" | "paginated" | "unknown";
  dataModel?: InferredDataModel;
  confidence: number;
  examples: string[];
}

export interface InferredDataModel {
  name: string;
  properties: Record<
    string,
    {
      type: string;
      required: boolean;
      nested?: InferredDataModel;
      isArray?: boolean;
    }
  >;
}

export interface PaginationPattern {
  type: "page" | "offset" | "cursor" | "link-header" | "none";
  params?: {
    pageParam?: string;
    limitParam?: string;
    offsetParam?: string;
    cursorParam?: string;
  };
  confidence: number;
}

export interface PatternDiscoveryResult {
  patterns: APIPattern[];
  pagination: PaginationPattern;
  rateLimiting?: {
    detected: boolean;
    headers?: string[];
    limit?: number;
    window?: string;
  };
  relationships: Array<{
    from: string;
    to: string;
    type: "one-to-many" | "many-to-many" | "reference";
  }>;
}

/**
 * Pattern matcher for advanced API analysis
 */
export class PatternMatcher {
  /**
   * Discover API patterns from requests and responses
   */
  async discover(
    requests: CapturedRequest[],
    responses: CapturedResponse[]
  ): Promise<PatternDiscoveryResult> {
    // Create response map for quick lookup
    const responseMap = new Map<string, CapturedResponse>();
    responses.forEach((res) => responseMap.set(res.requestId, res));

    // Filter to API requests only
    const apiRequests = requests.filter((req) => this.isApiRequest(req));

    // Discover patterns
    const patterns = this.identifyPatterns(apiRequests, responseMap);

    // Detect pagination
    const pagination = this.detectPagination(apiRequests, responseMap);

    // Detect rate limiting
    const rateLimiting = this.detectRateLimiting(responses);

    // Infer relationships between endpoints
    const relationships = this.inferRelationships(patterns);

    return {
      patterns,
      pagination,
      rateLimiting,
      relationships,
    };
  }

  /**
   * Identify API patterns (list, detail, create, etc.)
   */
  private identifyPatterns(
    requests: CapturedRequest[],
    responseMap: Map<string, CapturedResponse>
  ): APIPattern[] {
    const patternGroups = new Map<string, CapturedRequest[]>();

    // Group requests by method and path pattern
    for (const req of requests) {
      const url = new URL(req.url);
      const pathPattern = this.extractPathPattern(url.pathname);
      const key = `${req.method}:${pathPattern}`;

      if (!patternGroups.has(key)) {
        patternGroups.set(key, []);
      }
      patternGroups.get(key)!.push(req);
    }

    const patterns: APIPattern[] = [];

    // Analyze each pattern group
    for (const [key, groupRequests] of patternGroups) {
      const [method, pathPattern] = key.split(":", 2);
      const firstRequest = groupRequests[0];
      const firstResponse = responseMap.get(firstRequest.id);

      if (!firstResponse) continue;

      // Determine pattern type
      const patternType = this.determinePatternType(
        method,
        pathPattern,
        firstResponse
      );

      // Extract path parameters
      const pathParams = this.extractPathParams(pathPattern);

      // Extract common query parameters
      const queryParams = this.extractCommonQueryParams(groupRequests);

      // Detect auth method
      const authMethod = this.detectAuthMethodForRequests(groupRequests);

      // Extract required headers
      const requiredHeaders = this.extractRequiredHeaders(groupRequests);

      // Determine response type
      const responseType = this.determineResponseType(firstResponse);

      // Infer data model
      const dataModel = this.inferDataModel(
        pathPattern,
        firstResponse,
        responseType
      );

      // Calculate confidence
      const confidence = this.calculatePatternConfidence(
        patternType,
        groupRequests,
        responseMap
      );

      patterns.push({
        type: patternType,
        method,
        pathPattern,
        pathParams,
        queryParams,
        authMethod,
        requiredHeaders,
        responseType,
        dataModel,
        confidence,
        examples: groupRequests.slice(0, 3).map((r) => r.url),
      });
    }

    return patterns.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Determine the type of API pattern
   */
  private determinePatternType(
    method: string,
    pathPattern: string,
    response: CapturedResponse
  ): APIPatternType {
    // REST method-based detection
    if (method === "POST") return "create";
    if (method === "PUT" || method === "PATCH") return "update";
    if (method === "DELETE") return "delete";

    // GET endpoints - distinguish between list and detail
    if (method === "GET") {
      // Has path parameter → likely detail endpoint
      if (pathPattern.includes(":id") || pathPattern.includes(":uuid")) {
        return "detail";
      }

      // Check if it's a search endpoint
      if (
        pathPattern.includes("search") ||
        pathPattern.includes("query") ||
        pathPattern.includes("find")
      ) {
        return "search";
      }

      // Check response structure
      try {
        const body = JSON.parse(response.body);
        if (Array.isArray(body) || (body.data && Array.isArray(body.data))) {
          return "list";
        }
        if (body.results && Array.isArray(body.results)) {
          return "search";
        }
      } catch {
        // Not JSON, assume detail
      }

      return "detail";
    }

    return "detail"; // Default fallback
  }

  /**
   * Extract path parameters from pattern
   */
  private extractPathParams(pathPattern: string): string[] {
    const params: string[] = [];
    const segments = pathPattern.split("/");

    for (const segment of segments) {
      if (segment.startsWith(":")) {
        params.push(segment.substring(1));
      }
    }

    return params;
  }

  /**
   * Extract common query parameters across requests
   */
  private extractCommonQueryParams(requests: CapturedRequest[]): string[] {
    const paramCounts = new Map<string, number>();

    for (const req of requests) {
      try {
        const url = new URL(req.url);
        url.searchParams.forEach((_, key) => {
          paramCounts.set(key, (paramCounts.get(key) || 0) + 1);
        });
      } catch {
        // Invalid URL
      }
    }

    // Return params that appear in >50% of requests
    const threshold = requests.length * 0.5;
    return Array.from(paramCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([key]) => key);
  }

  /**
   * Detect authentication method for a group of requests
   */
  private detectAuthMethodForRequests(
    requests: CapturedRequest[]
  ): APIPattern["authMethod"] {
    const firstReq = requests[0];

    if (firstReq.headers["authorization"] || firstReq.headers["Authorization"]) {
      const authValue =
        firstReq.headers["authorization"] || firstReq.headers["Authorization"];
      if (authValue.toLowerCase().startsWith("bearer ")) return "bearer";
      if (authValue.toLowerCase().startsWith("basic ")) return "basic";
      return "custom";
    }

    if (firstReq.headers["x-api-key"] || firstReq.headers["X-Api-Key"]) {
      return "apikey";
    }

    if (firstReq.headers["cookie"] || firstReq.headers["Cookie"]) {
      return "cookie";
    }

    return "none";
  }

  /**
   * Extract headers that appear in all requests
   */
  private extractRequiredHeaders(
    requests: CapturedRequest[]
  ): Record<string, string> {
    if (requests.length === 0) return {};

    const requiredHeaders: Record<string, string> = {};
    const firstReq = requests[0];

    // Check which headers appear in all requests
    for (const [key, value] of Object.entries(firstReq.headers)) {
      // Skip standard browser headers
      if (this.isStandardHeader(key)) continue;

      // Check if it appears in all requests
      const appearsInAll = requests.every(
        (req) => req.headers[key] || req.headers[key.toLowerCase()]
      );

      if (appearsInAll) {
        requiredHeaders[key] = value;
      }
    }

    return requiredHeaders;
  }

  /**
   * Check if header is a standard browser header
   */
  private isStandardHeader(header: string): boolean {
    const standard = [
      "user-agent",
      "accept",
      "accept-encoding",
      "accept-language",
      "cache-control",
      "connection",
      "host",
      "referer",
      "sec-",
    ];
    const lower = header.toLowerCase();
    return standard.some((s) => lower.includes(s));
  }

  /**
   * Determine response type (array, object, paginated)
   */
  private determineResponseType(
    response: CapturedResponse
  ): APIPattern["responseType"] {
    try {
      const body = JSON.parse(response.body);

      if (Array.isArray(body)) return "array";

      // Check for paginated response structures
      if (
        body.data &&
        Array.isArray(body.data) &&
        (body.total || body.count || body.page || body.next)
      ) {
        return "paginated";
      }

      if (body.results && Array.isArray(body.results)) {
        return "paginated";
      }

      return "object";
    } catch {
      return "unknown";
    }
  }

  /**
   * Infer data model from response
   */
  private inferDataModel(
    pathPattern: string,
    response: CapturedResponse,
    responseType: APIPattern["responseType"]
  ): InferredDataModel | undefined {
    try {
      const body = JSON.parse(response.body);
      let sample: unknown;

      // Extract sample object
      if (Array.isArray(body) && body.length > 0) {
        sample = body[0];
      } else if (body.data && Array.isArray(body.data) && body.data.length > 0) {
        sample = body.data[0];
      } else if (
        body.results &&
        Array.isArray(body.results) &&
        body.results.length > 0
      ) {
        sample = body.results[0];
      } else if (typeof body === "object") {
        sample = body;
      }

      if (!sample || typeof sample !== "object") return undefined;

      // Generate model name from path
      const modelName = this.generateModelName(pathPattern);

      // Infer properties
      const properties = this.inferProperties(sample as Record<string, unknown>);

      return {
        name: modelName,
        properties,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Generate a model name from path pattern
   */
  private generateModelName(pathPattern: string): string {
    const segments = pathPattern.split("/").filter((s) => s && !s.startsWith(":"));
    const lastSegment = segments[segments.length - 1] || "Item";

    // Singularize and capitalize
    let name = lastSegment;
    if (name.endsWith("s")) {
      name = name.slice(0, -1);
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Infer properties from sample object
   */
  private inferProperties(
    obj: Record<string, unknown>
  ): InferredDataModel["properties"] {
    const properties: InferredDataModel["properties"] = {};

    for (const [key, value] of Object.entries(obj)) {
      const type = this.inferType(value);
      properties[key] = {
        type,
        required: value !== null && value !== undefined,
        isArray: Array.isArray(value),
      };

      // Recursively infer nested objects
      if (type === "object" && value && typeof value === "object") {
        properties[key].nested = {
          name: key.charAt(0).toUpperCase() + key.slice(1),
          properties: this.inferProperties(value as Record<string, unknown>),
        };
      }
    }

    return properties;
  }

  /**
   * Infer TypeScript type from value
   */
  private inferType(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) {
      return value.length > 0 ? `${this.inferType(value[0])}[]` : "unknown[]";
    }
    if (typeof value === "object") return "object";
    return typeof value;
  }

  /**
   * Calculate confidence score for pattern
   */
  private calculatePatternConfidence(
    patternType: APIPatternType,
    requests: CapturedRequest[],
    responseMap: Map<string, CapturedResponse>
  ): number {
    let confidence = 0.5;

    // More examples = higher confidence
    confidence += Math.min(requests.length * 0.05, 0.3);

    // Consistent responses = higher confidence
    const responses = requests
      .map((r) => responseMap.get(r.id))
      .filter((r) => r && r.status === 200);
    if (responses.length === requests.length) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Detect pagination patterns
   */
  private detectPagination(
    requests: CapturedRequest[],
    responseMap: Map<string, CapturedResponse>
  ): PaginationPattern {
    const queryParams = new Set<string>();
    let linkHeaderFound = false;

    for (const req of requests) {
      try {
        const url = new URL(req.url);
        url.searchParams.forEach((_, key) => queryParams.add(key.toLowerCase()));

        const response = responseMap.get(req.id);
        if (response?.headers["link"] || response?.headers["Link"]) {
          linkHeaderFound = true;
        }
      } catch {
        // Invalid URL
      }
    }

    // Detect pagination type
    if (linkHeaderFound) {
      return { type: "link-header", confidence: 0.9 };
    }

    if (queryParams.has("cursor") || queryParams.has("next_cursor")) {
      return {
        type: "cursor",
        params: { cursorParam: "cursor" },
        confidence: 0.9,
      };
    }

    if (queryParams.has("offset") || queryParams.has("skip")) {
      return {
        type: "offset",
        params: {
          offsetParam: queryParams.has("offset") ? "offset" : "skip",
          limitParam: queryParams.has("limit") ? "limit" : "take",
        },
        confidence: 0.85,
      };
    }

    if (queryParams.has("page")) {
      return {
        type: "page",
        params: {
          pageParam: "page",
          limitParam: queryParams.has("per_page")
            ? "per_page"
            : queryParams.has("limit")
              ? "limit"
              : "page_size",
        },
        confidence: 0.85,
      };
    }

    return { type: "none", confidence: 1.0 };
  }

  /**
   * Detect rate limiting from response headers
   */
  private detectRateLimiting(responses: CapturedResponse[]) {
    const rateLimitHeaders = new Set<string>();

    for (const res of responses) {
      for (const header of Object.keys(res.headers)) {
        if (
          header.toLowerCase().includes("rate-limit") ||
          header.toLowerCase().includes("ratelimit") ||
          header.toLowerCase() === "x-rate-limit-remaining"
        ) {
          rateLimitHeaders.add(header);
        }
      }
    }

    if (rateLimitHeaders.size > 0) {
      return {
        detected: true,
        headers: Array.from(rateLimitHeaders),
      };
    }

    return { detected: false };
  }

  /**
   * Infer relationships between endpoints
   */
  private inferRelationships(
    patterns: APIPattern[]
  ): PatternDiscoveryResult["relationships"] {
    const relationships: PatternDiscoveryResult["relationships"] = [];

    // Look for nested paths (e.g., /users/:id/posts)
    for (const pattern of patterns) {
      const segments = pattern.pathPattern.split("/").filter(Boolean);

      for (let i = 0; i < segments.length - 2; i++) {
        if (segments[i + 1] && segments[i + 1].startsWith(":")) {
          const parent = segments[i];
          const child = segments[i + 2];

          relationships.push({
            from: parent,
            to: child,
            type: "one-to-many",
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Check if request is an API call
   */
  private isApiRequest(req: CapturedRequest): boolean {
    const apiTypes = ["xhr", "fetch"];
    if (apiTypes.includes(req.resourceType.toLowerCase())) {
      return true;
    }

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
   * Extract path pattern (replace IDs with placeholders)
   */
  private extractPathPattern(path: string): string {
    return path
      .split("/")
      .map((segment) => {
        if (/^\d+$/.test(segment)) return ":id";
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            segment
          )
        )
          return ":uuid";
        if (/^[0-9a-f]{16,}$/i.test(segment)) return ":hash";
        return segment;
      })
      .join("/");
  }
}
