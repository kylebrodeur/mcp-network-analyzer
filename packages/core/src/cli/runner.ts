import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { Command } from 'commander';

import { CliContext } from './common.js';

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

async function runStatus(context: CliContext): Promise<void> {
  const { runStatusCommand } = await import('./status.js');
  await runStatusCommand(context);
}

async function runInstall(context: CliContext, args: string[]): Promise<void> {
  const { runInstallCommand } = await import('./install-client.js');
  await runInstallCommand(context, args);
}

async function runReset(context: CliContext, args: string[]): Promise<void> {
  const { runResetCommand } = await import('./reset.js');
  await runResetCommand(context, args);
}

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

  function buildProgram(context: CliContext): Command {
    const program = new Command();

    program
      .name(binName)
      .helpOption('-h, --help', 'Show help')
      .version(getVersion(), '-v, --version', 'Show package version');

    for (const ext of extensions) {
      const command = program
        .command(ext.command)
        .description(ext.description)
        .allowUnknownOption(true)
        .action(async (_options, cmd) => {
          await ext.run(context, cmd.args as string[]);
        });

      if (ext.helpLines?.length) {
        command.addHelpText('after', `\n${ext.command} options:\n${ext.helpLines.join('\n')}`);
      }
    }

    program
      .command('status')
      .description(BUILTIN_HELP[0].description)
      .action(async () => {
        await runStatus(context);
      });

    program
      .command('install')
      .description(BUILTIN_HELP[1].description)
      .allowUnknownOption(true)
      .addHelpText('after', `\ninstall options:\n${INSTALL_HELP_LINES.join('\n')}`)
      .action(async (_options, cmd) => {
        await runInstall(context, cmd.args as string[]);
      });

    program
      .command('reset')
      .description(BUILTIN_HELP[2].description)
      .allowUnknownOption(true)
      .action(async (_options, cmd) => {
        await runReset(context, cmd.args as string[]);
      });

    return program;
  }

  async function run(argv: string[]): Promise<void> {
    const context = buildContext();
    const [command] = argv;

    if (!command) {
      const hasConfig = existsSync(join(context.projectRoot, '.env'));
      if (hasConfig) {
        await runStatus(context);
      } else {
        const setupExt = extensions.find(e => e.command === 'setup');
        if (setupExt) {
          await setupExt.run(context, []);
        } else {
          buildProgram(context).outputHelp();
        }
      }
      return;
    }

    if (command === 'help') {
      buildProgram(context).outputHelp();
      return;
    }

    if (command === '--version' || command === '-v' || command === 'version') {
      console.log(getVersion());
      return;
    }

    const program = buildProgram(context);
    await program.parseAsync(argv, { from: 'user' });
  }

  return { run };
}
