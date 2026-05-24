import { NodeType } from "@marko/language-tools";
import type { CompletionItem, CompletionList } from "@volar/language-service";

import { MARKO_TEMPLATE_SOURCE, MarkoCompletionKind } from "./completion-types";
import type { MarkoComponentMetaSession } from "./component-meta";
import { AttrName } from "./source-completions/AttrName";
import { Import } from "./source-completions/Import";
import { OpenTagName } from "./source-completions/OpenTagName";
import { Tag } from "./source-completions/Tag";
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
      if (shouldUseSourceAttrCompletions(node, root)) {
        items = AttrName(
          node,
          root,
          offset,
          componentMeta?.getTagMetaForTag(getOwnerTagName(node) || ""),
        );
      }
      break;
    case NodeType.Import:
    case NodeType.Static:
      items = Import(node, root);
      break;
    case NodeType.Tag:
      items = Tag(node, root, offset);
      break;
    case NodeType.AttrTag:
    case NodeType.OpenTagName: {
      const openTagName =
        node.type === NodeType.AttrTag &&
        offset >= node.name.start &&
        offset <= node.name.end
          ? node.name
          : node.type === NodeType.OpenTagName
            ? node
            : undefined;
      if (openTagName?.parent.type === NodeType.AttrTag) {
        items = OpenTagName(
          openTagName,
          root,
          openTagName.parent.owner?.nameText
            ? componentMeta?.getTagMetaForTag(openTagName.parent.owner.nameText)
            : undefined,
        );
      }
      break;
    }
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

export function isSourceOnlyCompletionContext(
  templateContext: MarkoTemplateContext,
) {
  const { root, node, offset } = templateContext;

  switch (node?.type) {
    case NodeType.AttrName:
      return shouldUseSourceAttrCompletions(node, root);
    case NodeType.AttrArgs:
    case NodeType.AttrMethod:
    case NodeType.AttrSpread:
    case NodeType.Import:
    case NodeType.Placeholder:
    case NodeType.Scriptlet:
    case NodeType.Static:
    case NodeType.Tag:
    case NodeType.TagArgs:
    case NodeType.TagParams:
    case NodeType.TagTypeArgs:
    case NodeType.TagTypeParams:
    case NodeType.TagVar:
      return true;
    case NodeType.AttrTag:
      return offset >= node.name.start && offset <= node.name.end;
    case NodeType.OpenTagName:
      return node.parent.type === NodeType.AttrTag;
    case NodeType.AttrValue:
      return !isStaticQuotedAttrValue(root, node);
    default:
      return false;
  }
}

function isStaticQuotedAttrValue(
  root: MarkoTemplateContext["root"],
  node: Extract<
    NonNullable<MarkoTemplateContext["node"]>,
    { type: NodeType.AttrValue }
  >,
) {
  return !node.bound && /^['"]$/.test(root.code[node.value.start] || "");
}

function shouldUseSourceAttrCompletions(
  node: Extract<
    NonNullable<MarkoTemplateContext["node"]>,
    { type: NodeType.AttrName }
  >,
  root: MarkoTemplateContext["root"],
) {
  if (root.markoAst.read(node).includes(":")) {
    return true;
  }

  const tagName = getOwnerTagName(node) || "";
  const tag = tagName && root.tagLookup.getTag(tagName);
  return !tag || !tag.html;
}

function getOwnerTagName(
  node: Extract<
    NonNullable<MarkoTemplateContext["node"]>,
    { type: NodeType.AttrName }
  >,
) {
  const tag = node.parent.parent;
  return tag.type === NodeType.AttrTag ? tag.owner?.nameText : tag.nameText;
}
