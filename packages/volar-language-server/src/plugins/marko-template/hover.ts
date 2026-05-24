import type { MarkoVirtualCode } from "@marko/language-core";
import { type Node, NodeType } from "@marko/language-tools";
import type { Hover } from "@volar/language-service";
import { MarkupKind } from "vscode-languageserver";

import type { MarkoComponentMetaSession } from "./component-meta";
import {
  formatAttrTagMetaDocumentation,
  formatEventMetaDocumentation,
  formatInputMetaDocumentation,
} from "./documentation";
import { getHoverNameEnd, getHoverNameNodeAtOffset } from "./hover-target";
import type { MarkoTemplateContext } from "./util";

export function provideHover(
  templateContext: MarkoTemplateContext,
  htmlHover: Hover | null | undefined,
  componentMeta?: MarkoComponentMetaSession,
): Hover | undefined {
  if (htmlHover) {
    const range = getHoverRange(templateContext);
    return range ? { ...htmlHover, range } : htmlHover;
  }

  return provideSourceHover(templateContext, componentMeta);
}

function provideSourceHover(
  templateContext: MarkoTemplateContext,
  componentMeta?: MarkoComponentMetaSession,
): Hover | undefined {
  const { node, root, offset } = templateContext;
  const targetNode = getHoverNameNodeAtOffset(root, offset, node);

  if (
    targetNode?.type !== NodeType.OpenTagName &&
    targetNode?.type !== NodeType.AttrName
  ) {
    return;
  }

  switch (targetNode.type) {
    case NodeType.OpenTagName:
      return provideAttrTagHover(
        targetNode as Node.OpenTagName,
        root,
        componentMeta,
      );
    case NodeType.AttrName:
      return provideAttrHover(
        targetNode as Node.AttrName,
        root,
        offset,
        componentMeta,
      );
    default:
      return;
  }
}

function provideAttrTagHover(
  node: Node.OpenTagName,
  root: MarkoVirtualCode,
  componentMeta?: MarkoComponentMetaSession,
): Hover | undefined {
  const tag = node.parent;
  if (tag.type !== NodeType.AttrTag || !tag.owner?.nameText) {
    return;
  }

  const attrTagMeta = componentMeta?.getAttrTagMetaForTag(
    tag.owner.nameText,
    tag.nameText,
  );
  const value = attrTagMeta ? formatAttrTagMetaDocumentation(attrTagMeta) : "";
  if (!value) {
    return;
  }

  return {
    range: root.markoAst.locationAt(node),
    contents: {
      kind: MarkupKind.Markdown,
      value,
    },
  };
}

function provideAttrHover(
  node: Node.AttrName,
  root: MarkoVirtualCode,
  offset: number,
  componentMeta?: MarkoComponentMetaSession,
): Hover | undefined {
  const tagName = node.parent.parent.nameText || "";
  const rawName = root.markoAst.read(node);
  const modifierIndex = rawName.indexOf(":");
  const attrName =
    modifierIndex === -1 ? rawName : rawName.slice(0, modifierIndex);
  const inModifier =
    modifierIndex !== -1 && offset >= node.start + modifierIndex + 1;

  if (inModifier) {
    const modifier = rawName.slice(modifierIndex + 1);
    if (modifier !== "scoped" && modifier !== "no-update") {
      return;
    }

    return {
      range: root.markoAst.locationAt(node),
      contents: {
        kind: MarkupKind.Markdown,
        value: getModifierDocumentation(modifier),
      },
    };
  }

  if (modifierIndex !== -1) {
    return;
  }

  const parentTag = node.parent.parent;
  if (parentTag.type === NodeType.AttrTag) {
    return provideAttrTagInputHover(node, root, attrName, componentMeta);
  }

  if (node.parent.value?.type !== NodeType.AttrMethod) {
    return;
  }

  return provideMethodAttrHover(node, root, tagName, attrName, componentMeta);
}

function provideAttrTagInputHover(
  node: Node.AttrName,
  root: MarkoVirtualCode,
  attrName: string,
  componentMeta?: MarkoComponentMetaSession,
): Hover | undefined {
  const tag = node.parent.parent;
  if (tag.type !== NodeType.AttrTag || !tag.owner?.nameText) {
    return;
  }

  const inputMeta = componentMeta?.getAttrTagInputMetaForTag(
    tag.owner.nameText,
    tag.nameText,
    attrName,
  );
  if (inputMeta) {
    return createMarkdownHover(
      root,
      node,
      formatInputMetaDocumentation(inputMeta),
    );
  }

  return provideTaglibAttrHover(node, root, tag.nameText, attrName);
}

function provideMethodAttrHover(
  node: Node.AttrName,
  root: MarkoVirtualCode,
  tagName: string,
  attrName: string,
  componentMeta?: MarkoComponentMetaSession,
): Hover | undefined {
  const inputMeta = componentMeta?.getInputMetaForTag(tagName, attrName);
  if (inputMeta) {
    return createMarkdownHover(
      root,
      node,
      formatInputMetaDocumentation(inputMeta),
    );
  }

  const eventMeta = componentMeta?.getEventMetaForTag(tagName, attrName);
  if (eventMeta) {
    return createMarkdownHover(
      root,
      node,
      formatEventMetaDocumentation(eventMeta),
    );
  }

  return provideTaglibAttrHover(node, root, tagName, attrName);
}

function provideTaglibAttrHover(
  node: Node.AttrName,
  root: MarkoVirtualCode,
  tagName: string,
  attrName: string,
) {
  const attrDef = root.tagLookup.getAttribute(tagName, attrName);
  const autocomplete = Array.isArray(attrDef?.autocomplete)
    ? attrDef.autocomplete[0]
    : attrDef?.autocomplete;
  let value = attrDef?.description || "";

  if (autocomplete?.description) {
    value += value
      ? `\n\n${autocomplete.description}`
      : autocomplete.description;
  }

  if (autocomplete?.descriptionMoreURL) {
    value += value
      ? `\n\n[More Info](${autocomplete.descriptionMoreURL})`
      : `[More Info](${autocomplete.descriptionMoreURL})`;
  }

  if (!value) {
    return;
  }

  return createMarkdownHover(root, node, value);
}

function createMarkdownHover(
  root: MarkoVirtualCode,
  node: Node.AttrName,
  value: string,
): Hover | undefined {
  if (!value) {
    return;
  }

  return {
    range: root.markoAst.locationAt(node),
    contents: {
      kind: MarkupKind.Markdown,
      value,
    },
  };
}

function getModifierDocumentation(modifier: string) {
  switch (modifier) {
    case "scoped":
      return "Use to prefix with a unique ID.";
    case "no-update":
      return "Use to skip future updates to this attribute.";
    default:
      return `Marko attribute modifier \`${modifier}\`.`;
  }
}

function getHoverRange(templateContext: MarkoTemplateContext) {
  const targetNode = getHoverNameNodeAtOffset(
    templateContext.root,
    templateContext.offset,
    templateContext.node,
  );
  return (
    targetNode && {
      start: templateContext.document.positionAt(targetNode.start),
      end: templateContext.document.positionAt(
        getHoverNameEnd(templateContext.root, targetNode),
      ),
    }
  );
}
