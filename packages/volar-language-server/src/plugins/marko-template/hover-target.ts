import type { MarkoVirtualCode } from "@marko/language-core";
import { type Node, NodeType } from "@marko/language-tools";

export function getHoverNameNodeAtOffset(
  root: MarkoVirtualCode,
  offset: number,
  node?: ReturnType<MarkoVirtualCode["markoAst"]["nodeAt"]>,
): Node.AttrName | Node.OpenTagName | undefined {
  if (isHoverNameNode(root, offset, node)) {
    return node;
  }

  switch (node?.type) {
    case NodeType.Tag:
    case NodeType.AttrTag:
      return getHoverNameFromTag(root, offset, node);
    case NodeType.AttrNamed:
      return isHoverNameNode(root, offset, node.name) ? node.name : undefined;
  }
}

export function getHoverNameEnd(
  root: MarkoVirtualCode,
  node: Node.AttrName | Node.OpenTagName,
) {
  return getNameTextEnd(root, node);
}

function getHoverNameFromTag(
  root: MarkoVirtualCode,
  offset: number,
  tag: Node.ParentTag,
) {
  if (isHoverNameNode(root, offset, tag.name)) {
    return tag.name;
  }

  return tag.attrs?.find(
    (attr): attr is Node.AttrNamed =>
      attr.type === NodeType.AttrNamed &&
      isHoverNameNode(root, offset, attr.name),
  )?.name;
}

function isHoverNameNode(
  root: MarkoVirtualCode,
  offset: number,
  node: ReturnType<MarkoVirtualCode["markoAst"]["nodeAt"]> | undefined,
): node is Node.AttrName | Node.OpenTagName {
  if (node?.type !== NodeType.AttrName && node?.type !== NodeType.OpenTagName) {
    return false;
  }

  return offset >= node.start && offset <= getNameTextEnd(root, node);
}

function getNameTextEnd(
  root: MarkoVirtualCode,
  node: Node.AttrName | Node.OpenTagName,
) {
  return node.start + root.markoAst.read(node).trimEnd().length;
}
