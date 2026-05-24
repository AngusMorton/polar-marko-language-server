import { MarkoVirtualCode } from "@marko/language-core";
import { type Node, NodeType } from "@marko/language-tools";
import type {
  DocumentLink,
  LanguageServicePlugin,
} from "@volar/language-service";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

const importTagReg = /(['"])<((?:[^'"\\>]|\\.)*)>?\1/g;
const linkedAttrs = new Map<string, Set<string>>([
  [
    "src",
    new Set([
      "audio",
      "embed",
      "iframe",
      "img",
      "input",
      "script",
      "html-script",
      "source",
      "track",
      "video",
    ]),
  ],
  ["href", new Set(["a", "area", "link"])],
  ["data", new Set(["object"])],
  ["poster", new Set(["video"])],
]);

export const create = (): LanguageServicePlugin => {
  return {
    name: "marko-document-links",
    capabilities: {
      documentLinkProvider: {},
    },
    create(context) {
      return {
        provideDocumentLinks(document) {
          const info = resolveMarkoRoot(document);
          if (!info || info.uri.scheme !== "file") {
            return [];
          }

          return extractDocumentLinks(info.root, info.uri.toString());
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

function extractDocumentLinks(
  root: MarkoVirtualCode,
  documentUri: string,
): DocumentLink[] {
  const links: DocumentLink[] = [];
  const { markoAst, tagLookup } = root;

  for (const node of markoAst.program.static) {
    if (node.type !== NodeType.Import) {
      continue;
    }

    importTagReg.lastIndex = 0;
    const value = markoAst.read(node);
    const match = importTagReg.exec(value);
    if (!match) {
      continue;
    }

    const [{ length }, , tagName] = match;
    const tagDef = tagLookup.getTag(tagName);
    const fileForTag = tagDef && (tagDef.template || tagDef.renderer);
    if (!fileForTag) {
      continue;
    }

    links.push({
      range: markoAst.locationAt({
        start: node.start + match.index,
        end: node.start + match.index + length,
      }),
      target: URI.file(fileForTag).toString(),
    });
  }

  for (const node of markoAst.program.body) {
    visit(node);
  }

  return links;

  function visit(node: Node.ChildNode) {
    switch (node.type) {
      case NodeType.AttrTag:
        node.body?.forEach(visit);
        break;
      case NodeType.Tag:
        if (node.attrs && node.nameText) {
          for (const attr of node.attrs) {
            if (!isDocumentLinkAttr(root.code, node, attr)) {
              continue;
            }

            const target = resolveUrl(
              markoAst.read(attr.value.value).slice(1, -1),
              documentUri,
            );
            if (!target) {
              continue;
            }

            links.push({
              range: markoAst.locationAt(attr.value.value),
              target,
            });
          }
        }

        node.body?.forEach(visit);
        break;
    }
  }
}

function isDocumentLinkAttr(
  code: string,
  tag: Node.ParentTag,
  attr: Node.AttrNode,
): attr is Node.AttrNamed & { value: Node.AttrValue } {
  return (
    !!tag.nameText &&
    attr.type === NodeType.AttrNamed &&
    attr.value?.type === NodeType.AttrValue &&
    /^['"]$/.test(code[attr.value.value.start] || "") &&
    !!linkedAttrs
      .get(code.slice(attr.name.start, attr.name.end))
      ?.has(tag.nameText)
  );
}

function resolveUrl(to: string, base: string) {
  try {
    const url = new URL(to, base);
    return url.protocol === "file:" ? url.toString() : undefined;
  } catch {
    return;
  }
}
