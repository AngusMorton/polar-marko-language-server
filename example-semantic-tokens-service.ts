// Example implementation of semantic tokens for Marko language server
// This would be added to packages/language-server/src/plugins/

import type {
  DocumentSemanticTokensRequest,
  ServicePlugin,
} from "@volar/language-service";
import type {
  SemanticTokensBuilder,
  SemanticTokensLegend,
} from "vscode-languageserver";

// Define semantic token types for Marko
export const MARKO_TOKEN_TYPES = [
  "tag", // Marko tags like <div>, <for>
  "attribute", // Attributes like class, id
  "placeholder", // ${expression} placeholders
  "directive", // Marko directives like for, if
  "component", // Custom components
  "text", // Text content
] as const;

export const MARKO_TOKEN_MODIFIERS = [
  "builtin", // Built-in tags/attributes
  "control", // Control flow (for, if, etc.)
  "deprecated", // Deprecated features
] as const;

export function createMarkoSemanticTokensService(): ServicePlugin {
  return {
    name: "marko-semantic-tokens",

    create() {
      return {
        provideDocumentSemanticTokens(document, range, legend, token) {
          const builder = new SemanticTokensBuilder(legend);

          // Parse the Marko document and generate semantic tokens
          const markoAst = parseMarkoDocument(document.getText());

          visitMarkoAst(markoAst, (node, range) => {
            let tokenType: number;
            let tokenModifiers = 0;

            switch (node.type) {
              case "MarkoTag":
                tokenType = legend.tokenTypes.indexOf("tag");
                if (isBuiltinTag(node.name)) {
                  tokenModifiers |=
                    1 << legend.tokenModifiers.indexOf("builtin");
                }
                if (isControlFlowTag(node.name)) {
                  tokenModifiers |=
                    1 << legend.tokenModifiers.indexOf("control");
                }
                break;

              case "MarkoAttribute":
                tokenType = legend.tokenTypes.indexOf("attribute");
                if (isBuiltinAttribute(node.name)) {
                  tokenModifiers |=
                    1 << legend.tokenModifiers.indexOf("builtin");
                }
                break;

              case "MarkoPlaceholder":
                tokenType = legend.tokenTypes.indexOf("placeholder");
                break;

              default:
                return; // Skip unknown node types
            }

            builder.push(
              range.start.line,
              range.start.character,
              range.end.character - range.start.character,
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

// Helper functions (would need actual implementation)
function parseMarkoDocument(text: string) {
  // Use existing Marko parser from language-tools
  return null; // Placeholder
}

function visitMarkoAst(ast: any, visitor: (node: any, range: any) => void) {
  // Walk the AST and call visitor for each node
}

function isBuiltinTag(name: string): boolean {
  return ["for", "if", "while", "else-if", "else", "script", "style"].includes(
    name,
  );
}

function isControlFlowTag(name: string): boolean {
  return ["for", "if", "while", "else-if", "else"].includes(name);
}

function isBuiltinAttribute(name: string): boolean {
  return ["class", "id", "key", "on-click", "on-change"].includes(name);
}
