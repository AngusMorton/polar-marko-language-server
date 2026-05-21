import type { AttrTagMeta, TagMeta } from "@marko/component-meta";
import type { MarkoVirtualCode } from "@marko/language-core";
import { type Node, NodeType } from "@marko/language-tools";
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  type Range,
  TextEdit,
} from "vscode-languageserver";

import { formatAttrTagMetaDocumentation } from "../documentation";
import getTagNameCompletion from "../util/get-tag-name-completion";

export function OpenTagName(
  node: Node.OpenTagName,
  file: MarkoVirtualCode,
  tagMeta?: Pick<TagMeta, "input">,
): CompletionItem[] | undefined {
  const tag = node.parent;
  const range = file.markoAst.locationAt(node);
  const isAttrTag = tag.type === NodeType.AttrTag;
  const result: CompletionItem[] = [];

  if (isAttrTag) {
    for (const attrTag of tagMeta?.input?.attrTags ?? []) {
      result.push(getAttrTagCompletion(attrTag, range));
    }

    const ownerTagDef =
      tag.owner &&
      tag.owner.nameText &&
      file.tagLookup.getTag(tag.owner.nameText);

    if (ownerTagDef) {
      const { nestedTags } = ownerTagDef;
      for (const key in nestedTags) {
        if (key !== "*") {
          const tag = nestedTags[key];
          result.push(
            getTagNameCompletion({
              tag,
              range,
              importer: file.fileName,
              showAutoComplete: true,
            }),
          );
        }
      }
    }
  } else {
    const skipStatements = !(
      tag.concise && tag.parent.type === NodeType.Program
    );
    for (const tag of file.tagLookup.getTagsSorted()) {
      if (
        !(
          tag.name === "*" ||
          tag.isNestedTag ||
          (skipStatements && tag.parseOptions?.statement) ||
          (tag.name[0] === "_" &&
            /^@?marko[/-]|[\\/]node_modules[\\/]/.test(tag.filePath))
        )
      ) {
        const completion = getTagNameCompletion({
          tag,
          range,
          importer: file.fileName,
          showAutoComplete: true,
        });
        completion.sortText = `0${completion.label}`; // Ensure higher priority than typescript.
        result.push(completion);
      }
    }
  }

  return result;
}

function getAttrTagCompletion(attrTag: AttrTagMeta, range: Range) {
  let snippet = `@${attrTag.name}`;
  if (attrTag.props.length) {
    snippet += ` ${attrTag.props[0]!.name}=`;
  }
  if (attrTag.content && !attrTag.props.length) {
    snippet += `>$0</@${attrTag.name}>`;
  }

  return {
    label: `@${attrTag.name}${attrTag.required ? "" : "?"}`,
    documentation: {
      kind: MarkupKind.Markdown,
      value: formatAttrTagMetaDocumentation(attrTag),
    },
    kind: CompletionItemKind.Class,
    insertTextFormat: InsertTextFormat.Snippet,
    textEdit: TextEdit.replace(range, snippet),
  } satisfies CompletionItem;
}
