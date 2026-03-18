import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { CliContext } from './common.js';
import { runInstallCommand } from './install-client.js';
import { runResetCommand } from './reset.js';
import { runStatusCommand } from './status.js';

export interface CliExtension {
  /** The command name, e.g. "setup" or "serve". */
  command: string;
  /** One-line description shown in help output. */
  description: string;
  /** Handler invoked when this command is selected. */
  run: (context: CliContext, args: string[]) => Promise<void>;
  /** Optional extra help lines printed below the main command list. */
  helpLines?: string[];
}

export interface CliOptions {
  /** Binary name used in help output, e.g. "mcp-network-analyzer". */
  binName: string;
  /** Returns the package version string shown with --version. */
  getVersion: () => string;
  /** Package-specific commands to register alongside core built-ins. */
  extensions: CliExtension[];
  /** Overrides the project root; defaults to MCP_CLI_PROJECT_ROOT env or the parent of dist/. */
  projectRoot?: string;
}

const BUILTIN_HELP = [
  { command: 'status', description: 'Show build and configuration health' },
  { command: 'install', description: 'Detect MCP clients and install interactively' },
  { command: 'reset',  description: 'Clear config/data with confirmation prompts' },
];

const INSTALL_HELP_LINES = [
  '  --client <id>         Install to a specific client non-interactively',
  '                        ids: claude-desktop, vscode, vscode-user, vscode-workspace,',
  '                             claude-code, gemini, codex',
];

export function createCli(options: CliOptions): { run: (argv: string[]) => Promise<void> } {
  const { binName, getVersion, extensions } = options;

  function buildContext(): CliContext {
    const root = options.projectRoot;
    if (root) return { projectRoot: root };
    // Allow overriding the project root for development/testing
    const envRoot = process.env.MCP_CLI_PROJECT_ROOT;
    if (envRoot) return { projectRoot: envRoot };
    // Default: one level above dist/ (the installed package root)
    // We resolve via the import.meta.url of the CALLER, but since runner.ts
    // lives in core (bundled into dist/ of each consumer) we use process.cwd()
    // as a safe fallback and let callers override via projectRoot option.
    return { projectRoot: process.cwd() };
  }

  function printHelp(): void {
    const extensionHelp = extensions.map(e => {
      const padded = e.command.padEnd(22);
      return `  ${padded}${e.description}`;
    });
    const builtinHelp = BUILTIN_HELP.map(b => {
      const padded = b.command.padEnd(22);
      return `  ${padded}${b.description}`;
    });
    const extraLines: string[] = [];
    for (const ext of extensions) {
      if (ext.helpLines) extraLines.push('', `${ext.command} options:`, ...ext.helpLines);
    }
    // Extra lines for install built-in
    const installExtra = ['', 'install options:', ...INSTALL_HELP_LINES];

    console.log(`${binName} <command> [options]`);
    console.log('');
    console.log('Commands:');
    console.log([...extensionHelp, ...builtinHelp].join('\n'));
    console.log([...extraLines, ...installExtra].join('\n'));
    console.log('');
    console.log('Global options:');
    console.log('  -h, --help            Show help');
    console.log('  -v, --version         Show package version');
  }

  async function run(argv: string[]): Promise<void> {
    const context = buildContext();
    const [command, ...rest] = argv;

    if (!command) {
      const hasConfig = existsSync(join(context.projectRoot, '.env'));
      if (hasConfig) {
        await runStatusCommand(context);
      } else {
        const setupExt = extensions.find(e => e.command === 'setup');
        if (setupExt) {
          await setupExt.run(context, []);
        } else {
          printHelp();
        }
      }
      return;
    }

    if (command === '--help' || command === '-h' || command === 'help') {
      printHelp();
      return;
    }

    if (command === '--version' || command === '-v' || command === 'version') {
      console.log(getVersion());
      return;
    }

    // Check extension commands first
    const ext = extensions.find(e => e.command === command);
    if (ext) {
      await ext.run(context, rest);
      return;
    }

    // Built-in core commands
    switch (command) {
      case 'status':
        await runStatusCommand(context);
        return;
      case 'install':
        await runInstallCommand(context, rest);
        return;
      case 'reset':
        await runResetCommand(context, rest);
        return;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  }

  return { run };
}
