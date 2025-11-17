# Code Generation Prompts

This directory contains prompt files used by the AI code generator to create export scripts from discovered API patterns.

## Files

### `code-generation-system.md`

System-level instructions that define the AI's role and core principles:

- Use native HTTP clients (fetch, requests, net/http)
- Production-ready quality standards
- Security and configurability requirements

### `code-generation-typescript.md`

TypeScript-specific guidance:

- Use built-in `fetch` API (Node.js 18+)
- ES modules with strict types
- Code structure template

### `code-generation-python.md`

Python-specific guidance:

- Use `requests` library
- Type hints and PEP 8 style
- argparse for CLI
- Code structure template

### `code-generation-user.md`

Template for the user prompt (currently not used - kept for reference)
This was the original template-based approach that could be used with Handlebars if needed.

## How It Works

1. **System Prompt**: Loaded from `code-generation-system.md`
2. **Language Guidance**: Loaded from `code-generation-{language}.md`
3. **Dynamic Request**: Built programmatically with API patterns from analysis

The prompts emphasize:

- ✅ Native libraries only (no unnecessary dependencies)
- ✅ Clean, executable code with no explanations
- ✅ Proper error handling and retry logic
- ✅ Security (no hardcoded credentials)
- ✅ Configurability (CLI args, env vars)

## Editing Prompts

To improve code generation:

1. Edit the relevant `.md` file in this directory
2. Rebuild the project: `pnpm run build`
3. Test with: `generate_export_tool` MCP tool

No code changes needed - prompts are loaded at runtime!
