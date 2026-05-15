import type { MarkoVirtualCode } from "@marko/language-core";
import { type Node, NodeType } from "@marko/language-tools";
import type { Hover } from "@volar/language-service";
import { MarkupKind } from "vscode-languageserver";

import getTagNameCompletion from "../marko/util/get-tag-name-completion";
import { isHTML } from "../marko/util/is-html";
import type { MarkoComponentMetaSession } from "./component-meta";
import {
  formatInputMetaDocumentation,
  formatTagMetaDocumentation,
} from "./documentation";
import type { MarkoTemplateContext } from "./util";

export function provideHover(
  templateContext: MarkoTemplateContext,
  htmlHover: Hover | null | undefined,
  componentMeta?: MarkoComponentMetaSession,
): Hover | undefined {
  if (isModifierHoverContext(templateContext)) {
    return provideSourceHover(templateContext, componentMeta);
  }

  return htmlHover ?? provideSourceHover(templateContext, componentMeta);
}

function provideSourceHover(
  templateContext: MarkoTemplateContext,
  componentMeta?: MarkoComponentMetaSession,
): Hover | undefined {
  const { node, root, offset } = templateContext;
  const fallbackAttrNode = getAttrNameNodeAtOffset(root, offset);
  const targetNode = fallbackAttrNode ?? node;

  if (
    targetNode?.type !== NodeType.OpenTagName &&
    targetNode?.type !== NodeType.AttrName
  ) {
    return;
  }

  switch (targetNode.type) {
    case NodeType.OpenTagName:
      return provideTagHover(
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

function provideTagHover(
  node: Node.OpenTagName,
  root: MarkoVirtualCode,
  componentMeta?: MarkoComponentMetaSession,
): Hover | undefined {
  const tag = node.parent;
  const tagDef = tag.nameText && root.tagLookup.getTag(tag.nameText);

  if (!tagDef) {
    return;
  }

  if (!isHTML(tagDef)) {
    const tagMeta =
      tag.nameText && componentMeta?.getTagMetaForTag(tag.nameText);
    const value = tagMeta ? formatTagMetaDocumentation(tagMeta) : "";
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

  const completion = getTagNameCompletion({
    tag: tagDef,
    importer: root.fileName,
  });

  if (!completion.documentation) {
    return;
  }

  return {
    range: root.markoAst.locationAt(node),
    contents: completion.documentation,
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

  const attrDef = root.tagLookup.getAttribute(tagName, attrName);
  const inputMeta = componentMeta?.getInputMetaForTag(tagName, attrName);
  if (!attrDef && !inputMeta) {
    return;
  }

  const autocomplete = Array.isArray(attrDef?.autocomplete)
    ? attrDef.autocomplete[0]
    : attrDef?.autocomplete;
  let value = inputMeta
    ? formatInputMetaDocumentation(inputMeta, attrDef?.description)
    : attrDef?.description || "";

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

function isModifierHoverContext(templateContext: MarkoTemplateContext) {
  const attrNode = getAttrNameNodeAtOffset(
    templateContext.root,
    templateContext.offset,
  );
  if (!attrNode) {
    return false;
  }

  const rawName = templateContext.root.markoAst.read(attrNode);
  const modifierIndex = rawName.indexOf(":");
  return (
    modifierIndex !== -1 &&
    templateContext.offset > attrNode.start + modifierIndex
  );
}

function getAttrNameNodeAtOffset(root: MarkoVirtualCode, offset: number) {
  const current = root.markoAst.nodeAt(offset);
  if (current?.type === NodeType.AttrName) {
    return current;
  }

  if (current) {
    return;
  }

  const previous = offset > 0 ? root.markoAst.nodeAt(offset - 1) : undefined;
  if (previous?.type === NodeType.AttrName) {
    return previous;
  }
}
