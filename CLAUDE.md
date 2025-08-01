# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This repository contains both a TypeScript monorepo with npm workspaces and a separate IntelliJ plugin using Gradle:

### TypeScript Monorepo Packages:

- `packages/language-server` - The Marko Language Server Protocol implementation
- `packages/language-tools` - Core language analysis tools for Marko
- `packages/vscode` - VS Code extension for Marko
- `packages/type-check` - Type checking utilities

### IntelliJ Plugin:

- `intellij-plugin/` - IntelliJ IDEA plugin for Marko language support

### Build & Development

**TypeScript Monorepo:**

- `npm run build` - Build all packages in production mode
- `npm run build:dev` - Build VS Code extension in development mode
- `npm run lint` - Lint and check formatting across all packages
- `npm run format` - Format and fix linting issues across all packages
- `npm run test` - Run all tests across packages

**IntelliJ Plugin:**

- `cd intellij-plugin && ./gradlew build` - Build the IntelliJ plugin
- `cd intellij-plugin && ./gradlew test` - Run plugin tests
- `cd intellij-plugin && ./gradlew test --tests "TestClassName.testMethodName"` - Run single test
- `cd intellij-plugin && ./gradlew build -x test` - Build without running tests

### Package-specific commands

- `npm run -w packages/language-server test` - Run language server tests
- `npm run -w packages/language-server test:update` - Update test snapshots
- `npm run -w packages/vscode test` - Run VS Code extension tests

### Release Management

- `npm run change` - Add a changeset for release
- `npm run version` - Update versions using changesets
- `npm run release` - Build and publish packages

## Architecture

This project provides Language Server Protocol (LSP) support for the Marko templating language across multiple IDEs. The architecture consists of a core TypeScript monorepo and a separate IntelliJ plugin.

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

**IntelliJ Plugin (`intellij-plugin/`)**

- Kotlin-based plugin for IntelliJ IDEA and other JetBrains IDEs
- Uses hybrid client strategy: native LSP API for Ultimate editions, LSP4IJ fallback for Community editions
- Bundles Node.js runtime and `@marko/language-server` for hermetic operation
- Key components:
  - `MarkoLspServerDescriptor` - Manages language server lifecycle and command line creation
  - `MarkoLspServerSupportProvider` - Integrates with IntelliJ's native LSP support
  - `MarkoLanguageServerFactory` - Fallback integration for LSP4IJ plugin
  - `MarkoFileType` and `MarkoLanguage` - Basic file type and language registration

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

**IntelliJ Plugin Build System**:

- Uses Gradle with IntelliJ Platform plugin for build automation
- Node.js runtime (v20.11.1) is automatically downloaded and bundled
- Language server dependencies are installed via npm and packaged into `src/main/resources/ls-dist/`
- Supports both test and production builds with hermetic dependency management

## Testing

**TypeScript Monorepo**: Uses Mocha with snapshot testing via `mocha-snap`. Test fixtures are in `src/__tests__/fixtures/` with separate directories for HTML and script test cases. Each fixture contains a `.marko` file and corresponding `__snapshots__/` directory with expected outputs.

Update snapshots when making changes that affect output:

```bash
npm run -w packages/language-server test:update
```

**IntelliJ Plugin**: Uses JUnit 4 with IntelliJ Platform test framework. Tests are located in `src/test/kotlin/com/markojs/intellij/`. Key test categories:

- `MarkoFileTypeTest` - File type registration and recognition
- `MarkoDiagnosticsTest` - LSP diagnostics integration (tests file processing without requiring actual LSP server)
- `MarkoHoverTest` - Hover information functionality
- `MarkoCompatibilityTest` - IDE compatibility detection (native LSP vs LSP4IJ)
- `MarkoServerDescriptorTest` - Language server command line creation

Tests include mock language server setup for integration testing without external dependencies.

## Configuration Files

**TypeScript Monorepo**:

- `tsconfig.json` - Strict TypeScript configuration with composite project setup
- `eslint.config.mjs` - ESLint configuration with TypeScript and import sorting rules
- Individual packages have their own `tsconfig.json` extending the root configuration

**IntelliJ Plugin**:

- `build.gradle.kts` - Gradle build configuration with IntelliJ Platform plugin, Node.js setup, and dependency management
- `gradle.properties` - Gradle build properties
- `src/main/resources/META-INF/plugin.xml` - Main plugin descriptor with extension points
- `src/main/resources/META-INF/with-lsp4ij.xml` - LSP4IJ fallback configuration for Community editions
- `intellij-plugin/package.json` - Node.js dependencies (specifically `@marko/language-server`)

## IntelliJ Plugin Development Notes

The IntelliJ plugin follows a strict architecture focused on low maintenance burden by delegating all language intelligence to the external `@marko/language-server`. The plugin acts purely as an LSP client and does not implement its own parsing or language analysis.

**Key Design Principles**:

- Hermetic operation: Bundles Node.js runtime and language server to avoid user configuration issues
- Hybrid compatibility: Supports both Ultimate (native LSP) and Community (LSP4IJ) editions
- Graceful degradation: Shows user notification if neither LSP client is available
- No custom PSI: Relies entirely on LSP for language features to minimize maintenance

**Build Process**:
The Gradle build automatically downloads Node.js runtime, installs npm dependencies, and packages everything into the plugin distribution. The `prepareBundledResources` task handles copying the language server and its dependencies into `src/main/resources/ls-dist/` for distribution.
