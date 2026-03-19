import { defineConfig } from 'tsup';

const shared = {
  format: ['esm'] as const,
  target: 'node18' as const,
  platform: 'node' as const,
  sourcemap: true,
  splitting: false,
  // Bundle core so the published package is self-contained.
  noExternal: ['@mcp-network-analyzer/core'],
  // Keep true runtime deps as externals — installed alongside this package.
  external: ['playwright', '@modelcontextprotocol/sdk', 'zod', 'commander'],
};

export default defineConfig([
  // MCP server entry (programmatic / stdio)
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    dts: true,
    clean: true,
  },
  // CLI entry — shebang already in src/cli.ts
  {
    ...shared,
    entry: { cli: 'src/cli.ts' },
    dts: false,
  },
]);
