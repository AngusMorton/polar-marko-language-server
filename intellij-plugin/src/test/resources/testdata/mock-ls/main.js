#!/usr/bin/env node

/**
 * Mock Language Server for Marko IntelliJ Plugin Tests
 *
 * This is a minimal LSP server implementation that provides hardcoded responses
 * for testing purposes. It communicates over stdio using JSON-RPC 2.0.
 */

const readline = require("readline");

class MockMarkoLanguageServer {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.requestId = 0;
    this.initialized = false;

    this.setupMessageHandling();
  }

  setupMessageHandling() {
    let buffer = "";

    process.stdin.on("data", (chunk) => {
      buffer += chunk.toString();

      while (true) {
        const match = buffer.match(/^Content-Length: (\d+)\r?\n\r?\n/);
        if (!match) break;

        const contentLength = parseInt(match[1]);
        const headerLength = match[0].length;

        if (buffer.length < headerLength + contentLength) break;

        const message = buffer.substr(headerLength, contentLength);
        buffer = buffer.substr(headerLength + contentLength);

        try {
          const jsonMessage = JSON.parse(message);
          this.handleMessage(jsonMessage);
        } catch (error) {
          this.sendError(-32700, "Parse error", null);
        }
      }
    });
  }

  handleMessage(message) {
    if (message.method) {
      // Handle notifications and requests
      switch (message.method) {
        case "initialize":
          this.handleInitialize(message);
          break;
        case "initialized":
          this.initialized = true;
          break;
        case "textDocument/didOpen":
          this.handleDidOpen(message);
          break;
        case "textDocument/completion":
          this.handleCompletion(message);
          break;
        case "textDocument/hover":
          this.handleHover(message);
          break;
        case "shutdown":
          this.handleShutdown(message);
          break;
        case "exit":
          process.exit(0);
          break;
        default:
          if (message.id) {
            this.sendError(-32601, "Method not found", message.id);
          }
      }
    }
  }

  handleInitialize(message) {
    const response = {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        capabilities: {
          textDocumentSync: 1, // Full sync
          completionProvider: {
            triggerCharacters: ["<", " ", "="],
          },
          hoverProvider: true,
          diagnosticProvider: {
            interFileDependencies: false,
            workspaceDiagnostics: false,
          },
        },
        serverInfo: {
          name: "Mock Marko Language Server",
          version: "1.0.0-test",
        },
      },
    };

    this.sendMessage(response);
  }

  handleDidOpen(message) {
    const uri = message.params.textDocument.uri;
    const text = message.params.textDocument.text;

    // Send diagnostics for specific test files
    if (uri.includes("diagnostics.marko")) {
      this.sendDiagnostics(uri, text);
    }
  }

  sendDiagnostics(uri, text) {
    // Look for specific patterns that should trigger diagnostics
    const lines = text.split("\n");
    const diagnostics = [];

    lines.forEach((line, index) => {
      if (line.includes("undefined-component")) {
        diagnostics.push({
          range: {
            start: { line: index, character: 0 },
            end: { line: index, character: line.length },
          },
          message: 'Component "undefined-component" is not defined',
          severity: 1, // Error
          source: "marko",
        });
      }

      if (line.includes("missing-attribute")) {
        const startChar = line.indexOf("missing-attribute");
        diagnostics.push({
          range: {
            start: { line: index, character: startChar },
            end: {
              line: index,
              character: startChar + "missing-attribute".length,
            },
          },
          message: "Required attribute is missing",
          severity: 2, // Warning
          source: "marko",
        });
      }
    });

    const notification = {
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: {
        uri: uri,
        diagnostics: diagnostics,
      },
    };

    // Send diagnostics after a small delay to simulate real server behavior
    setTimeout(() => {
      this.sendMessage(notification);
    }, 100);
  }

  handleCompletion(message) {
    const uri = message.params.textDocument.uri;
    const position = message.params.position;

    let completionItems = [];

    if (uri.includes("completion.marko")) {
      // Provide mock completions based on context
      completionItems = [
        {
          label: "div",
          kind: 13, // Keyword
          insertText: "div",
          documentation: "HTML div element",
        },
        {
          label: "span",
          kind: 13, // Keyword
          insertText: "span",
          documentation: "HTML span element",
        },
        {
          label: "for",
          kind: 14, // Snippet
          insertText: "for(item in items)",
          documentation: "Marko for loop",
        },
        {
          label: "if",
          kind: 14, // Snippet
          insertText: "if(condition)",
          documentation: "Marko conditional",
        },
        {
          label: "class",
          kind: 5, // Field
          insertText: 'class="$1"',
          insertTextFormat: 2, // Snippet
          documentation: "CSS class attribute",
        },
      ];
    }

    const response = {
      jsonrpc: "2.0",
      id: message.id,
      result: {
        isIncomplete: false,
        items: completionItems,
      },
    };

    this.sendMessage(response);
  }

  handleHover(message) {
    const uri = message.params.textDocument.uri;
    const position = message.params.position;

    if (uri.includes("hover.marko")) {
      const response = {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          contents: {
            kind: "markdown",
            value:
              "**Marko Component**\n\nThis is a mock hover response for testing.",
          },
          range: {
            start: position,
            end: { line: position.line, character: position.character + 10 },
          },
        },
      };

      this.sendMessage(response);
    } else {
      this.sendMessage({
        jsonrpc: "2.0",
        id: message.id,
        result: null,
      });
    }
  }

  handleShutdown(message) {
    const response = {
      jsonrpc: "2.0",
      id: message.id,
      result: null,
    };

    this.sendMessage(response);
  }

  sendMessage(message) {
    const content = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(content, "utf8")}\r\n\r\n`;
    process.stdout.write(header + content);
  }

  sendError(code, message, id) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: id,
      error: {
        code: code,
        message: message,
      },
    };

    this.sendMessage(errorResponse);
  }
}

// Start the mock server
const server = new MockMarkoLanguageServer();

// Handle process termination gracefully
process.on("SIGTERM", () => {
  process.exit(0);
});

process.on("SIGINT", () => {
  process.exit(0);
});
