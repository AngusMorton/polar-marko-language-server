import type { MarkoVirtualCode } from "@marko/language-core";
import { type Node, NodeType } from "@marko/language-tools";
import type { DocumentSymbol } from "@volar/language-service";
import { SymbolKind } from "vscode-languageserver";

import { isHTML } from "./util/is-html";

export function provideDocumentSymbols(
  root: MarkoVirtualCode,
): DocumentSymbol[] {
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
    const attrTagName = node.nameText.split(":").pop() || node.nameText;
    return attrTagName.startsWith("@") ? attrTagName : `@${attrTagName}`;
  }

  return node.nameText || "<${...}>";
}

function getSymbolKind(root: MarkoVirtualCode, node: Node.Tag | Node.AttrTag) {
  return node.nameText && isHTML(root.tagLookup.getTag(node.nameText))
    ? SymbolKind.Property
    : SymbolKind.Class;
}
