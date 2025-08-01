# How to Add LSP Semantic Tokens to Marko Language Server

This document explains how to implement LSP semantic tokens in the Marko language server to provide rich syntax highlighting via the Language Server Protocol.

## Overview

LSP semantic tokens provide a more powerful alternative to TextMate grammars by allowing the language server to provide semantic information about tokens in the code. This enables more accurate and context-aware syntax highlighting.

## Implementation Steps

### 1. Add Semantic Tokens Service to Language Server

Create a new service plugin in `packages/language-server/src/plugins/marko-semantic-tokens.ts`:

```typescript
import type {
  ServicePlugin,
  DocumentSemanticTokensRequest,
} from "@volar/language-service";
import type { SemanticTokensBuilder } from "vscode-languageserver";
import { parseMarko } from "@marko/language-tools";

// Define semantic token types for Marko
export const MARKO_SEMANTIC_TOKEN_TYPES = [
  "tag", // Marko tags like <div>, <for>
  "attribute", // Attributes like class, id
  "placeholder", // ${expression} placeholders
  "directive", // Marko directives like for, if
  "component", // Custom components
  "text", // Text content
  "comment", // Comments
  "string", // String literals
  "number", // Number literals
  "operator", // Operators
  "keyword", // Keywords
] as const;

export const MARKO_SEMANTIC_TOKEN_MODIFIERS = [
  "builtin", // Built-in tags/attributes
  "control", // Control flow (for, if, etc.)
  "deprecated", // Deprecated features
  "readonly", // Read-only attributes
] as const;

export function createMarkoSemanticTokensService(): ServicePlugin {
  return {
    name: "marko-semantic-tokens",

    create(context) {
      return {
        provideDocumentSemanticTokens(document, range, legend, token) {
          const builder = new SemanticTokensBuilder(legend);
          const sourceFile = context.getSourceFile(document.uri);

          if (!sourceFile?.markoAst) {
            return null;
          }

          // Walk the Marko AST and generate semantic tokens
          visitMarkoAst(sourceFile.markoAst, (node, position) => {
            const tokenInfo = getTokenInfo(node);
            if (!tokenInfo) return;

            const tokenType = legend.tokenTypes.indexOf(tokenInfo.type);
            if (tokenType === -1) return;

            let tokenModifiers = 0;
            for (const modifier of tokenInfo.modifiers) {
              const modifierIndex = legend.tokenModifiers.indexOf(modifier);
              if (modifierIndex !== -1) {
                tokenModifiers |= 1 << modifierIndex;
              }
            }

            builder.push(
              position.line,
              position.character,
              tokenInfo.length,
              tokenType,
              tokenModifiers,
            );
          });

          return builder.build();
        },
      };
    },
  };
}

function getTokenInfo(node: any) {
  switch (node.type) {
    case "MarkoTag":
      return {
        type: isCustomComponent(node.name) ? "component" : "tag",
        modifiers: getTagModifiers(node.name),
        length: node.name.length,
      };

    case "MarkoAttribute":
      return {
        type: "attribute",
        modifiers: getAttributeModifiers(node.name),
        length: node.name.length,
      };

    case "MarkoPlaceholder":
      return {
        type: "placeholder",
        modifiers: [],
        length: node.value.length + 3, // Include ${}
      };

    case "MarkoText":
      return {
        type: "text",
        modifiers: [],
        length: node.value.length,
      };

    default:
      return null;
  }
}

function isCustomComponent(tagName: string): boolean {
  // Components start with uppercase or contain dashes
  return /^[A-Z]/.test(tagName) || tagName.includes("-");
}

function getTagModifiers(tagName: string): string[] {
  const modifiers: string[] = [];

  // Built-in tags
  if (
    ["for", "if", "while", "else-if", "else", "script", "style"].includes(
      tagName,
    )
  ) {
    modifiers.push("builtin");
  }

  // Control flow tags
  if (["for", "if", "while", "else-if", "else"].includes(tagName)) {
    modifiers.push("control");
  }

  return modifiers;
}

function getAttributeModifiers(attrName: string): string[] {
  const modifiers: string[] = [];

  // Built-in attributes
  if (["class", "id", "key"].includes(attrName)) {
    modifiers.push("builtin");
  }

  // Read-only attributes
  if (attrName.startsWith("on-") || attrName.endsWith("Change")) {
    modifiers.push("readonly");
  }

  return modifiers;
}

function visitMarkoAst(ast: any, visitor: (node: any, position: any) => void) {
  // Implement AST traversal using existing Marko parser utilities
  // This would integrate with the existing AST structure from @marko/language-tools
}
```

### 2. Register the Service in Language Server

Add the semantic tokens service to `packages/language-server/src/plugins/index.ts`:

```typescript
import { createMarkoSemanticTokensService } from "./marko-semantic-tokens";

export function createServicePlugins(
  ts: typeof import("typescript/lib/tsserverlibrary"),
) {
  const result = [
    createMarkoService(ts),
    createMarkoHtmlService(),
    createCssService(),
    // Add semantic tokens service
    createMarkoSemanticTokensService(),
    ...createTypeScriptServices(ts),
    // ... other services
  ];

  return result;
}
```

### 3. Update Server Capabilities

Modify the server initialization to declare semantic tokens support in `packages/language-server/src/index.ts`:

```typescript
const server = createServer({
  // ... existing config
  capabilities: {
    // ... existing capabilities
    semanticTokensProvider: {
      legend: {
        tokenTypes: MARKO_SEMANTIC_TOKEN_TYPES,
        tokenModifiers: MARKO_SEMANTIC_TOKEN_MODIFIERS,
      },
      range: true,
      full: {
        delta: true,
      },
    },
  },
});
```

### 4. Test the Implementation

1. Build the language server: `npm run build`
2. Test with VS Code extension to verify semantic tokens work
3. Test with IntelliJ plugin to ensure LSP highlighting is used

## Benefits of LSP Semantic Tokens

1. **Context-Aware**: The language server understands the semantic meaning of tokens
2. **Accurate**: More precise than regex-based TextMate grammars
3. **Consistent**: Same highlighting across all IDE clients
4. **Extensible**: Easy to add new token types and modifiers
5. **Performance**: Can be cached and incremental updates supported

## Integration with IntelliJ Plugin

The IntelliJ plugin implementation already includes:

- `MarkoLspSemanticTokensHighlighter`: Maps LSP tokens to IntelliJ text attributes
- `MarkoLspSemanticTokensSupport`: Registers with IntelliJ's LSP system
- `MarkoSyntaxHighlighterFactory`: Prefers LSP highlighting when available

When the language server provides semantic tokens, the IntelliJ plugin will automatically use them for syntax highlighting instead of falling back to TextMate or basic highlighting.
