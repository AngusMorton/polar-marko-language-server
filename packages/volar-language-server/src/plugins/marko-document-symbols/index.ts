import { MarkoVirtualCode } from "@marko/language-core";
import { type Node, NodeType } from "@marko/language-tools";
import type {
  DocumentSymbol,
  LanguageServicePlugin,
} from "@volar/language-service";
import { SymbolKind } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { isHTML } from "../shared/is-html";

export const create = (): LanguageServicePlugin => {
  return {
    name: "marko-document-symbols",
    capabilities: {
      documentSymbolProvider: true,
    },
    create(context) {
      return {
        provideDocumentSymbols(document) {
          const info = resolveMarkoRoot(document);
          if (!info || info.uri.scheme !== "file") {
            return [];
          }

          return extractDocumentSymbols(info.root);
        },
      };

      function resolveMarkoRoot(document: TextDocument) {
        const documentUri = URI.parse(document.uri);
        const decoded = context.decodeEmbeddedDocumentUri(documentUri);
        const sourceUri = decoded?.[0] ?? documentUri;
        const sourceScript = context.language.scripts.get(sourceUri);
        const rootCode = sourceScript?.generated?.root;
        if (!(rootCode instanceof MarkoVirtualCode)) {
          return;
        }

        if (decoded && decoded[1] !== rootCode.id) {
          return;
        }

        return {
          root: rootCode,
          uri: sourceUri,
        };
      }
    },
  };
};

function extractDocumentSymbols(root: MarkoVirtualCode): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];

  for (const node of root.markoAst.program.body) {
    const symbol = createSymbol(root, node);
    if (symbol) {
      symbols.push(symbol);
    }
  }

  return symbols;
}

function createSymbol(
  root: MarkoVirtualCode,
  node: Node.ChildNode,
): DocumentSymbol | undefined {
  switch (node.type) {
    case NodeType.Tag:
    case NodeType.AttrTag:
      return {
        name: getSymbolName(node),
        kind: getSymbolKind(root, node),
        range: root.markoAst.locationAt(node),
        selectionRange: root.markoAst.locationAt(node.name),
        children: node.body?.flatMap((child) => {
          const symbol = createSymbol(root, child);
          return symbol ? [symbol] : [];
        }),
      };
  }
}

function getSymbolName(node: Node.Tag | Node.AttrTag) {
  if (node.type === NodeType.AttrTag) {
    const name = node.nameText?.split(":").pop();
    return name ? (name.startsWith("@") ? name : `@${name}`) : "<${...}>";
  }

  return node.nameText || "<${...}>";
}

function getSymbolKind(root: MarkoVirtualCode, node: Node.Tag | Node.AttrTag) {
  return node.nameText && isHTML(root.tagLookup.getTag(node.nameText))
    ? SymbolKind.Property
    : SymbolKind.Class;
}
