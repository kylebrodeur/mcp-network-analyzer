// lib
export { Config } from './lib/config.js';
export type { ConfigOptions, CloudStorageConfig, StorageMode } from './lib/config.js';
export { Storage } from './lib/storage.js';
export { DatabaseService } from './lib/database.js';
export { BrowserManager } from './lib/browser.js';
export { NetworkInterceptor } from './lib/interceptor.js';
export { NetworkAnalyzer } from './lib/analyzer.js';
export type { AnalysisSummary, EndpointGroup, AuthInfo } from './lib/analyzer.js';
export { PatternMatcher } from './lib/pattern-matcher.js';
export type { APIPattern, PatternDiscoveryResult, PaginationPattern } from './lib/pattern-matcher.js';
export type { CaptureSession, CapturedRequest, CapturedResponse, BrowserConfig, InterceptorOptions, StorageResult } from './lib/types.js';

// tools
export { registerCaptureTool, captureNetworkRequests } from './tools/capture.js';
export type { CaptureOptions, CaptureResult } from './tools/capture.js';
export { registerAnalyzeTool, analyzeCapturedData } from './tools/analyze.js';
export type { AnalyzeOptions, AnalyzeResult } from './tools/analyze.js';
export { registerDiscoverTool, discoverApiPatterns } from './tools/discover.js';
export type { DiscoverOptions, DiscoverResult } from './tools/discover.js';
export { registerSearchTool } from './tools/search.js';
export { registerHelpTools } from './tools/help.js';
export { registerIdManagementTools } from './tools/id-management.js';
export { registerConfigTools } from './tools/config.js';

// cli
export type { CliContext, Profile, ProfileData } from './cli/common.js';
export { loadEnvFile, writeEnvFile, loadProfiles, saveProfiles, getEnvPath, getProfilesPath, parseEnvContent } from './cli/common.js';
export { runStatusCommand } from './cli/status.js';
export { runInstallClaudeCommand } from './cli/install-claude.js';
export { runInstallCommand, detectMcpClients } from './cli/install-client.js';
export type { McpClientInfo } from './cli/install-client.js';
export { runResetCommand } from './cli/reset.js';
export { createCli } from './cli/runner.js';
export type { CliExtension, CliOptions } from './cli/runner.js';
