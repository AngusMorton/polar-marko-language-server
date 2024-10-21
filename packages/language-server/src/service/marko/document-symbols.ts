import { type Node, NodeType } from "@marko/language-tools";
import { DocumentSymbol, SymbolKind } from "vscode-languageserver-protocol";
import { MarkoVirtualCode } from "../core/marko-plugin";

/**
 * Iterate over the Marko CST and extract all the symbols (mostly tags) in the document.
 */
export function provideDocumentSymbols(
  file: MarkoVirtualCode,
): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  const { program } = file.markoAst;
  const visit = (node: Node.ChildNode) => {
    switch (node.type) {
      case NodeType.Tag:
      case NodeType.AttrTag:
        symbols.push({
          name:
            (node.type === NodeType.AttrTag
              ? node.nameText?.slice(node.nameText.indexOf("@"))
              : node.nameText) || "<${...}>",
          kind:
            (node.nameText &&
              file.tagLookup.getTag(node.nameText)?.html &&
              SymbolKind.Property) ||
            SymbolKind.Class,
          range: {
            start: file.markoAst.positionAt(node.start),
            end: file.markoAst.positionAt(node.end),
          },
          selectionRange: {
            start: file.markoAst.positionAt(node.start),
            end: file.markoAst.positionAt(node.end),
          },
        });

        if (node.body) {
          for (const child of node.body) {
            visit(child);
          }
        }

        break;
    }
  };

  for (const item of program.body) {
    visit(item);
  }

  console.log("Symbolts", symbols);

  return symbols;
}
