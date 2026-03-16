# Copilot Instructions

These instructions tell GitHub Copilot (and other codegen agents) how to collaborate inside this repository.

## Project Context

- Build an MCP server that can capture browser network traffic, analyze API patterns, and auto-generate export tools.
- Preferred stack: TypeScript + Playwright primary, Puppeteer (with stealth) as fallback.
- Storage approach: JSON for raw captures, SQLite/FTS for indexing, Handlebars templates for generated code.

## Coding Guidelines

1. Keep TypeScript strict-mode friendly and avoid `any` unless absolutely required.
2. Centralize shared types inside `src/lib/types.ts` (create as features mature) and reuse schemas with Zod.
3. Prefer async/await with structured error handling and contextual logging for every tool action.
4. Never block STDOUT with logs; route diagnostics through STDERR or the MCP logging channel.
5. Keep generated files (captures, analyses, exports) under `data/` and respect `.gitignore`.

## Workflow Expectations

- `src/index.ts` is the MCP entry point; register tools/patterns here.
- Each tool gets its own module under `src/tools/` and should rely on helpers from `src/lib/`.
- Add lightweight smoke tests for complex logic before wiring it into the server.
- Update documentation (`README.md`, `docs/`) when behavior or commands change.

## Developer Experience

- Use the provided pnpm scripts (`dev`, `build`, `type-check`, `clean`).
- Keep VS Code tasks/launch configs in sync with new scripts.
- When adding a new tool, also document its inputs/outputs in README and PLAN.

## Documentation

- Active documentation is in `/README.md`, `/docs/PROJECT_STATUS.md`, `/docs/PLAN.md`, `/docs/DUAL_MODE_ARCHITECTURE.md`, and `/docs/BLAXEL_INTEGRATION.md`.
- **Ignore archived documentation:** Files in `/docs/_archive/` are historical and should not be referenced for current implementation decisions.
