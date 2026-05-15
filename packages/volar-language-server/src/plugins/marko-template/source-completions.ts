import { NodeType } from "@marko/language-tools";
import type { CompletionItem, CompletionList } from "@volar/language-service";

import { AttrName } from "../marko/complete/AttrName";
import { Import } from "../marko/complete/Import";
import { OpenTagName } from "../marko/complete/OpenTagName";
import { Tag } from "../marko/complete/Tag";
import { MARKO_TEMPLATE_SOURCE, MarkoCompletionKind } from "./completion-types";
import type { MarkoComponentMetaSession } from "./component-meta";
import type { MarkoTemplateContext } from "./util";

export function provideSourceOnlyCompletions(
  templateContext: MarkoTemplateContext,
  componentMeta?: MarkoComponentMetaSession,
): CompletionList | undefined {
  const { root, offset, node } = templateContext;
  if (!node) {
    return;
  }

  let items: CompletionItem[] | undefined;

  switch (node.type) {
    case NodeType.AttrName:
      items = AttrName(
        node,
        root,
        offset,
        componentMeta?.getTagMetaForTag(node.parent.parent.nameText || ""),
      );
      break;
    case NodeType.Import:
    case NodeType.Static:
      items = Import(node, root);
      break;
    case NodeType.Tag:
      items = Tag(node, root, offset);
      break;
    case NodeType.OpenTagName:
      if (node.parent.type === NodeType.AttrTag) {
        items = OpenTagName(node, root);
      }
      break;
  }

  if (!items?.length) {
    return;
  }

  for (const item of items) {
    item.data = {
      source: MARKO_TEMPLATE_SOURCE,
      kind: MarkoCompletionKind.Source,
    };
  }

  return {
    isIncomplete: false,
    items,
  };
}
