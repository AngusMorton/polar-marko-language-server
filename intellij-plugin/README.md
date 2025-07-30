Specification: Marko IntelliJ Plugin

1. Overview
   This document specifies the requirements and design for an IntelliJ Platform plugin providing language support for the Marko language (.marko files).

The primary, non-functional requirement that informs all design decisions is low maintenance burden. The plugin's architecture MUST prioritize stability, automation, and delegation of language-specific logic to external, community-maintained tools.

2. Core Architecture & Language Intelligence
   2.1. Language Server Protocol (LSP) Utilization: The plugin MUST provide all language intelligence features (e.g., completion, diagnostics, go-to-definition) by acting as a client to the existing @marko/language-server. The plugin  

MUST NOT implement its own language parser or a Program Structure Interface (PSI) model.  

- Rationale: This is the cornerstone of the low-maintenance strategy. It offloads the responsibility of parsing and analyzing the Marko language to the dedicated language server project, which is maintained by the language's own team. This decouples the plugin's maintenance cycle from the Marko language's evolution.

3. Language Server & Dependency Management
   3.1. Hermetic Environment: The plugin MUST create a hermetic runtime environment for the language server to eliminate user-side configuration failures.

- 3.1.1. Bundled Dependencies: The plugin MUST bundle a specific, version-pinned Node.js runtime and the @marko/language-server npm package within its distributable artifact. The plugin  

MUST NOT rely on a user's globally installed Node.js or language server package.

- 3.1.2. Build Automation: The Gradle build process MUST automate the fetching of the specified Node.js runtime and the installation of npm dependencies declared in a package.json file. A Gradle plugin such as com.github.node-gradle.node SHOULD be used for this purpose.  

- 3.1.3. Packaging: The prepareSandbox Gradle task MUST be configured to copy the bundled Node.js runtime and the resulting node_modules directory into the plugin's distributable archive, for example, into a lib/ls-dist/ subdirectory.  

  3.2. Server Lifecycle:

- 3.2.1. Server Invocation: The plugin MUST launch the language server by constructing a command line that executes the bundled Node.js binary against the bundled language server entry script.  

- 3.2.2. Communication Protocol: The server process MUST be launched with the --stdio argument to enable communication over standard I/O streams.

4. IDE Compatibility & Graceful Degradation
   4.1. Hybrid Client Strategy: To maximize the user base while providing the most seamless experience, the plugin MUST support both commercial and community editions of JetBrains IDEs through a hybrid client strategy.

4.2. Primary Integration (Commercial IDEs): The plugin MUST primarily integrate with the native JetBrains LSP client API, available in commercial IDEs since version 2023.2.  

- Implementation: This MUST be achieved by registering an implementation of the com.intellij.platform.lsp.serverSupportProvider extension point.  

  4.3. Fallback Integration (Community IDEs): The plugin MUST provide a fallback mechanism for IDEs that lack the native LSP client, such as IntelliJ IDEA Community Edition.

- 4.3.1. Optional Dependency: The plugin MUST declare an optional dependency on Red Hat's LSP4IJ plugin (com.redhat.devtools.lsp4ij) in its plugin.xml descriptor.  

- Example: <depends optional="true" config-file="with-lsp4ij.xml">com.redhat.devtools.lsp4ij</depends>.  

- 4.3.2. Runtime Detection: The plugin MUST perform a runtime check to determine which LSP client is available.
- If the native LspServerSupportProvider class is found, the native integration MUST be used.
- If the native API is absent, the plugin MUST check for the presence of LSP4IJ's APIs. If found, it MUST use them to register the language server.
- 4.3.3. Graceful Degradation: If neither the native API nor the LSP4IJ plugin is available, all language-aware features MUST be disabled. The plugin SHOULD then present a single, non-modal notification to the user explaining the situation and MAY provide a direct action to install the LSP4IJ plugin from the JetBrains Marketplace.  

5. Scope and Limitations
   5.1. Feature Parity: The plugin's feature set is strictly limited to the capabilities exposed by the @marko/language-server via the Language Server Protocol. The plugin itself implements no language-specific logic.  

5.2. Exclusions: Features that require deep IDE integration beyond the scope of the LSP specification (e.g., custom refactoring dialogs, language-specific structure view customizations) MUST NOT be implemented, in adherence to the primary goal of low maintenance.
