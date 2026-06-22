# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Polar Marko Language Server, a fork of the Marko Language Server modified to use Volar as the language tooling framework. It provides TypeScript-based language support for Marko templating files.

## Development Commands

### Build Commands

- `npm run build` - Build all packages in the workspace
- `npm run build:dev` - Build the VS Code extension in development mode
- `npm run build -w @marko/language-server` - Build specific language server package
- `npm run build -w @marko/volar-language-server` - Build Volar-based language server

### Testing Commands

- `npm test` - Run all tests (builds first, then runs workspace tests)
- `npm run test:server` - Build and run language server tests with snapshot updates
- `npm run test -w @marko/language-server` - Run tests for original language server
- `npm run test -w @marko/volar-language-server` - Run tests for Volar language server
- `npm run perf -w @marko/volar-language-server` - Run performance tests (60s timeout)

### Code Quality Commands

- `npm run lint` - Run ESLint, Prettier check, and spell check
- `npm run format` - Auto-fix ESLint issues and format with Prettier

### Package-Specific Testing

- `npm run test:update` - Update test snapshots (available in language server packages)

## Architecture

### Package Structure

This is a monorepo with the following key packages:

- **`packages/language-server/`** - Original language server implementation
- **`packages/volar-language-server/`** - Volar-based language server (primary implementation)
- **`packages/language-tools/`** - Shared language tooling utilities
- **`packages/language-core/`** - Core parsing and processing logic
- **`packages/component-meta/`** - Component metadata extraction
- **`packages/type-check/`** - TypeScript type checking utilities
- **`packages/vscode/`** - VS Code extension

### Key Technologies

- **Volar** - Language tooling framework (used in volar-language-server)
- **TypeScript** - Primary language with strict type checking
- **Marko** - Template language being supported
- **Mocha** - Testing framework with snapshot support
- **ESLint/Prettier** - Code formatting and linting

### Language Server Dual Implementation

The repository maintains two language server implementations:

1. Original implementation (`@marko/language-server`)
2. Volar-based implementation (`@marko/volar-language-server`) - This is the primary/preferred implementation

Both servers provide similar functionality but use different underlying frameworks.

### Test Architecture

- Tests use Mocha with snapshot testing via `mocha-snap`
- Fixtures are organized under `__tests__/fixtures/` directories
- Performance tests are in `__perf__/` directories
- Update snapshots with `--update` flag or `npm run test:update`

## Development Workflow

1. Make changes to source code in `src/` directories
2. Run `npm run build` to compile TypeScript
3. Run `npm test` to verify changes
4. Use `npm run lint` to check code quality
5. Run `npm run format` to auto-fix formatting issues

## Workspace Configuration

This uses npm workspaces with packages managed independently. Use `-w <package-name>` flag to run commands in specific packages.
