import type { InputMeta, TagMeta } from "@marko/component-meta";
import { MarkoVirtualCode } from "@marko/language-core";
import { type Node, NodeType } from "@marko/language-tools";
import {
  type CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  type MarkupContent,
  MarkupKind,
  TextEdit,
} from "vscode-languageserver";

import { formatInputMetaDocumentation } from "../documentation";

export function AttrName(
  node: Node.AttrName,
  file: MarkoVirtualCode,
  offset: number,
  tagMeta?: Pick<TagMeta, "input" | "inputs">,
): CompletionItem[] | undefined {
  let name = file.markoAst.read(node);
  const modifierIndex = name.indexOf(":");
  const hasModifier = modifierIndex !== -1;

  if (hasModifier) {
    if (offset >= node.start + modifierIndex) {
      return [
        {
          label: "scoped",
          kind: CompletionItemKind.Keyword,
          detail: "Use to prefix with a unique ID",
        },
        {
          label: "no-update",
          kind: CompletionItemKind.Keyword,
          detail: "Use to skip future updates to this attribute",
        },
      ];
    } else {
      name = name.slice(0, modifierIndex);
    }
  }

  const completions: CompletionItem[] = [];
  const seenNames = new Set<string>();
  const inputMetaByName = new Map<string, InputMeta>(
    getInputProps(node, tagMeta).map((input) => [input.name, input]) ?? [],
  );
  const attrNameLoc = file.markoAst.locationAt(
    hasModifier
      ? {
          start: node.start,
          end: node.start + name.length,
        }
      : node,
  );

  const tag = node.parent.parent;
  const tagName =
    tag.type === NodeType.AttrTag
      ? tag.owner?.nameText || ""
      : tag.nameText || "";
  const tagDef = tagName && file.tagLookup.getTag(tagName);
  const nestedTagAttrs: { [x: string]: boolean } = {};

  if (tagDef && tagDef.nestedTags) {
    for (const key in tagDef.nestedTags) {
      const nestedTagDef = tagDef.nestedTags[key];
      nestedTagAttrs[nestedTagDef.targetProperty] = true;
    }
  }

  file.tagLookup.forEachAttribute(tagName, (attr, parent) => {
    if (
      attr.deprecated ||
      nestedTagAttrs[attr.name] ||
      attr.name === "*" ||
      attr.type === "never" ||
      (attr.name[0] === "_" &&
        isExternalModule(attr.filePath || parent.filePath))
    ) {
      return;
    }

    const type = attr.type || (attr.html ? "string" : null);
    const inputMeta = inputMetaByName.get(attr.name);
    const enumValues = inputMeta?.enumValues ?? attr.enum;
    seenNames.add(attr.name);
    const documentation: MarkupContent = {
      kind: MarkupKind.Markdown,
      value: inputMeta
        ? formatInputMetaDocumentation(inputMeta, attr.description)
        : attr.description || "",
    };
    let label = attr.name;
    let snippet = attr.name;

    if (enumValues?.length) {
      // TODO: We should use the following, but vscode has a regression with multi choice snippets form the language server.
      // snippet += `="\${1|${enumValues.join()}|}"$0`;
      snippet += `="$1"$0`;
    } else {
      switch (type) {
        case "string":
          snippet += '="$1"$0';
          break;
        case "function":
          snippet += "=($1)$0";
          break;
        case "statement":
        case "boolean":
        case "flag":
          break;
        default:
          snippet += "=";
          break;
      }
    }

    const autocomplete =
      attr.autocomplete && Array.isArray(attr.autocomplete)
        ? attr.autocomplete[0]
        : attr.autocomplete;

    if (autocomplete) {
      label = autocomplete.displayText || label;
      snippet = autocomplete.snippet || snippet;

      if (autocomplete.descriptionMoreURL) {
        if (documentation.value) {
          documentation.value += `\n\n`;
        }

        documentation.value += `[More Info](${autocomplete.descriptionMoreURL})`;
      }
    }

    if (!attr.required) {
      label += "?";
    }

    completions.push({
      label,
      documentation: documentation.value ? documentation : undefined,
      kind: CompletionItemKind.Property,
      insertTextFormat: InsertTextFormat.Snippet,
      textEdit: TextEdit.replace(attrNameLoc, snippet),
    });
  });

  for (const input of getInputProps(node, tagMeta)) {
    if (seenNames.has(input.name) || nestedTagAttrs[input.name]) {
      continue;
    }

    let snippet = input.name;
    if (input.enumValues?.length || /^(?:string|number)$/.test(input.type)) {
      snippet += '="$1"$0';
    } else if (
      /=>|^\(.*\)\s*=>|^\(.*\):/.test(input.type) ||
      /=>/.test(input.type)
    ) {
      snippet += "=($1)$0";
    } else if (input.type !== "boolean") {
      snippet += "=";
    }

    completions.push({
      label: input.required ? input.name : `${input.name}?`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: formatInputMetaDocumentation(input),
      },
      kind: CompletionItemKind.Property,
      insertTextFormat: InsertTextFormat.Snippet,
      textEdit: TextEdit.replace(attrNameLoc, snippet),
    });
  }

  for (const event of getInputEvents(node, tagMeta)) {
    if (seenNames.has(event.name) || nestedTagAttrs[event.name]) {
      continue;
    }

    completions.push({
      label: event.required ? event.name : `${event.name}?`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: `\`${event.name}: ${event.signature || event.type}\`${
          event.description ? `\n\n${event.description}` : ""
        }`,
      },
      kind: CompletionItemKind.Function,
      insertTextFormat: InsertTextFormat.Snippet,
      textEdit: TextEdit.replace(attrNameLoc, `${event.name}($1) {\n\t$0\n}`),
    });
  }

  return completions;
}

function getInputProps(
  node: Node.AttrName,
  tagMeta: Pick<TagMeta, "input" | "inputs"> | undefined,
) {
  const tag = node.parent.parent;
  if (tag.type === NodeType.AttrTag) {
    const attrTagName = tag.nameText.split(":").pop();
    return (
      (tag.owner?.nameText
        ? tagMeta?.input?.attrTags.find((attrTag) =>
            attrTagMatches(attrTag, attrTagName),
          )?.props
        : undefined) ?? []
    );
  }

  return tagMeta?.input?.props ?? tagMeta?.inputs ?? [];
}

function getInputEvents(
  node: Node.AttrName,
  tagMeta: Pick<TagMeta, "input" | "inputs"> | undefined,
) {
  const tag = node.parent.parent;
  if (tag.type === NodeType.AttrTag) {
    const attrTagName = tag.nameText.split(":").pop();
    return (
      (tag.owner?.nameText
        ? tagMeta?.input?.attrTags.find((attrTag) =>
            attrTagMatches(attrTag, attrTagName),
          )?.events
        : undefined) ?? []
    );
  }

  return tagMeta?.input?.events ?? [];
}

function attrTagMatches(
  attrTag: NonNullable<Pick<TagMeta, "input">["input"]>["attrTags"][number],
  attrTagName: string | undefined,
) {
  return attrTag.name === attrTagName || attrTag.propertyName === attrTagName;
}

function isExternalModule(file: string) {
  return (
    /[/\\]node_modules[/\\]/.test(file) || !/^(?:[A-Za-z]:\\|[./\\])/.test(file)
  );
}
