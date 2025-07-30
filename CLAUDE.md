# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is a TypeScript monorepo using npm workspaces with the following packages:

- `packages/language-server` - The Marko Language Server Protocol implementation
- `packages/language-tools` - Core language analysis tools for Marko
- `packages/vscode` - VS Code extension for Marko
- `packages/type-check` - Type checking utilities

### Build & Development

- `npm run build` - Build all packages in production mode
- `npm run build:dev` - Build VS Code extension in development mode
- `npm run lint` - Lint and check formatting across all packages
- `npm run format` - Format and fix linting issues across all packages
- `npm run test` - Run all tests across packages

### Package-specific commands

- `npm run -w packages/language-server test` - Run language server tests
- `npm run -w packages/language-server test:update` - Update test snapshots
- `npm run -w packages/vscode test` - Run VS Code extension tests

### Release Management

- `npm run change` - Add a changeset for release
- `npm run version` - Update versions using changesets
- `npm run release` - Build and publish packages

## Architecture

This project provides Language Server Protocol (LSP) support for the Marko templating language, built on the Volar framework.

### Core Architecture

**Language Server (`packages/language-server`)**

- Built on Volar's LSP framework for extensible language support
- Entry point: `src/index.ts` - Creates connection, initializes TypeScript project
- Language plugin: `src/language/` - Handles Marko file parsing and analysis
- Service plugins: `src/plugins/` - Provides features like completion, diagnostics, hover

**Language Tools (`packages/language-tools`)**

- Core analysis engine for Marko templates
- Extractors in `src/extractors/` parse HTML, script, and style sections
- Parser in `src/parser.ts` handles overall Marko template structure
- Processors in `src/processors/` handle different file types

**VS Code Extension (`packages/vscode`)**

- Activates language server for `.marko` files
- Registers debug commands and syntax highlighting
- Provides TypeScript plugin integration via `modules/marko-ts-plugin/`

### Key Components

**Language Plugin System**: Uses Volar's plugin architecture where:

- Language plugins handle file parsing and virtual file generation
- Service plugins provide LSP features (completion, diagnostics, etc.)

**TypeScript Integration**:

- Automatically adds Marko type definitions to TypeScript projects
- Uses TypeScript's program API for type checking and IntelliSense
- Requires `typescript.tsdk` configuration pointing to TypeScript lib directory

**Multi-language Support**:

- HTML extraction for template markup
- Script extraction for TypeScript/JavaScript code blocks
- Style extraction for CSS/SCSS within templates
- Each section gets its own virtual file for language services

## Testing

The project uses Mocha with snapshot testing via `mocha-snap`. Test fixtures are in `src/__tests__/fixtures/` with separate directories for HTML and script test cases. Each fixture contains a `.marko` file and corresponding `__snapshots__/` directory with expected outputs.

Update snapshots when making changes that affect output:

```bash
npm run -w packages/language-server test:update
```

## Configuration Files

- `tsconfig.json` - Strict TypeScript configuration with composite project setup
- `eslint.config.mjs` - ESLint configuration with TypeScript and import sorting rules
- Individual packages have their own `tsconfig.json` extending the root configuration
