import type { MarkoVirtualCode } from "@marko/language-core";
import {
  getLines,
  getLocation,
  type Node,
  NodeType,
} from "@marko/language-tools";
import type {
  LanguageServiceContext,
  LocationLink,
} from "@volar/language-service";
import fs from "fs";
import path from "path";
import type ts from "typescript";
import { URI } from "vscode-uri";

import { START_LOCATION } from "../../utils/constants";
import RegExpBuilder from "../../utils/regexp-builder";
import type { MarkoComponentMetaSession } from "./component-meta";
import { getScriptCompletionDocument } from "./util";

export function provideDefinition(
  context: LanguageServiceContext,
  root: MarkoVirtualCode,
  offset: number,
  node: ReturnType<MarkoVirtualCode["markoAst"]["nodeAt"]>,
  componentMeta?: MarkoComponentMetaSession,
): LocationLink[] | undefined {
  const tsDefinitions = provideTypeScriptDefinition(context, root, offset);
  if (tsDefinitions?.length) {
    return tsDefinitions;
  }

  if (!node) {
    return;
  }

  switch (node.type) {
    case NodeType.AttrName:
      return provideAttrDefinition(node, root, componentMeta);
    case NodeType.OpenTagName:
      return provideTagDefinition(node, root);
    default:
      return;
  }
}

function provideTypeScriptDefinition(
  context: LanguageServiceContext,
  root: MarkoVirtualCode,
  offset: number,
): LocationLink[] | undefined {
  const embedded = getScriptCompletionDocument(
    context,
    URI.file(root.fileName),
  );
  if (!embedded) {
    return;
  }

  let generatedOffset: number | undefined;
  for (const [mappedOffset] of embedded.map.toGeneratedLocation(
    offset,
    (data) => !!data.navigation,
  )) {
    generatedOffset = mappedOffset;
    break;
  }

  if (generatedOffset === undefined) {
    return;
  }

  const tsPlugin = context.plugins.find(
    ([plugin]) => plugin.name === "typescript-semantic",
  )?.[1];
  const languageService = tsPlugin?.provide?.["typescript/languageService"]?.();
  const getDocumentFileName =
    tsPlugin?.provide?.["typescript/documentFileName"];
  if (!languageService || !getDocumentFileName) {
    return;
  }

  const fileName = getDocumentFileName(URI.parse(embedded.document.uri));
  const definitions = languageService.getDefinitionAndBoundSpan(
    fileName,
    generatedOffset,
  )?.definitions;

  if (!definitions?.length) {
    return;
  }

  return definitions.map((definition: ts.DefinitionInfo) => {
    const targetUri = URI.file(definition.fileName).toString();
    const range = rangeFromTextSpan(
      definition.textSpan.start,
      definition.textSpan.length,
      definition.fileName,
      context,
    );

    return {
      targetUri,
      targetRange: range,
      targetSelectionRange: range,
      originSelectionRange: root.markoAst.locationAt(
        root.markoAst.nodeAt(offset) ?? {
          start: offset,
          end: offset,
        },
      ),
    } satisfies LocationLink;
  });
}

function rangeFromTextSpan(
  start: number,
  length: number,
  fileName: string,
  context: LanguageServiceContext,
) {
  const script = context.language.scripts.get(URI.file(fileName));
  const document = script
    ? context.documents.get(script.id, script.languageId, script.snapshot)
    : undefined;

  if (!document) {
    return START_LOCATION;
  }

  return {
    start: document.positionAt(start),
    end: document.positionAt(start + length),
  };
}

function provideAttrDefinition(
  node: Node.AttrName,
  root: MarkoVirtualCode,
  componentMeta?: MarkoComponentMetaSession,
): LocationLink[] | undefined {
  const tagName = node.parent.parent.nameText || "";
  const rawAttrName = root.markoAst.read(node);
  const attrName = rawAttrName.split(":", 1)[0]!;
  const metaDefinitions = componentMeta
    ?.getInputMetaForTag(tagName, attrName)
    ?.declarations.map((declaration) =>
      declarationToLocationLink(declaration, root.markoAst.locationAt(node)),
    )
    .filter((link): link is LocationLink => !!link);
  const tagDef = tagName ? root.tagLookup.getTag(tagName) : undefined;
  const attrDef = root.tagLookup.getAttribute(tagName, attrName);

  if (!attrDef) {
    return metaDefinitions?.length ? metaDefinitions : undefined;
  }

  const attrEntryFile =
    attrDef.name === "*"
      ? tagDef?.template || tagDef?.renderer || tagDef?.filePath
      : attrDef.filePath || tagDef?.filePath;
  if (!attrEntryFile || !path.isAbsolute(attrEntryFile)) {
    return;
  }

  let range = START_LOCATION;
  if (/\.json$/.test(attrEntryFile)) {
    const tagDefSource = fs.readFileSync(attrEntryFile, "utf-8");
    const escaped = escapeRegExp(
      attrDef.name === "*" ? attrName : attrDef.name,
    );
    const match =
      RegExpBuilder`/"(?:@?${escaped}|${escaped})"\s*:\s*[^\r\n,]+/g`.exec(
        tagDefSource,
      );

    if (match && match.index !== undefined) {
      range = getLocation(
        getLines(tagDefSource),
        match.index,
        match.index + match[0].length,
      );
    }
  }

  const taglibDefinition = {
    targetUri: URI.file(attrEntryFile).toString(),
    targetRange: range,
    targetSelectionRange: range,
    originSelectionRange: root.markoAst.locationAt(node),
  } satisfies LocationLink;

  return metaDefinitions?.length
    ? [...metaDefinitions, taglibDefinition]
    : [taglibDefinition];
}

function declarationToLocationLink(
  declaration: MarkoComponentMetaSession extends never
    ? never
    : NonNullable<
        ReturnType<MarkoComponentMetaSession["getInputMetaForTag"]>
      >["declarations"][number],
  originSelectionRange: LocationLink["originSelectionRange"],
): LocationLink | undefined {
  if (!path.isAbsolute(declaration.file) || !fs.existsSync(declaration.file)) {
    return;
  }

  const source = fs.readFileSync(declaration.file, "utf-8");
  const range = getLocation(
    getLines(source),
    declaration.range[0],
    declaration.range[1],
  );

  return {
    targetUri: URI.file(declaration.file).toString(),
    targetRange: range,
    targetSelectionRange: range,
    originSelectionRange,
  } satisfies LocationLink;
}

function provideTagDefinition(
  node: Node.OpenTagName,
  root: MarkoVirtualCode,
): LocationLink[] | undefined {
  const tag = node.parent;
  const tagDef =
    tag.type === NodeType.AttrTag
      ? tag.owner?.nameText
        ? root.tagLookup.getTag(tag.owner.nameText)
        : undefined
      : tag.nameText
        ? root.tagLookup.getTag(tag.nameText)
        : undefined;

  if (!tagDef) {
    return;
  }

  const tagEntryFile = tagDef.template || tagDef.renderer || tagDef.filePath;
  if (!path.isAbsolute(tagEntryFile)) {
    return;
  }

  let range = START_LOCATION;
  if (/\/marko(?:-tag)?\.json$/.test(tagEntryFile)) {
    const tagDefSource = fs.readFileSync(tagEntryFile, "utf-8");
    const match =
      RegExpBuilder`/"(?:<${tag.nameText}>|${tag.nameText})"\s*:\s*[^\r\n,]+/g`.exec(
        tagDefSource,
      );

    if (match && match.index !== undefined) {
      range = getLocation(
        getLines(tagDefSource),
        match.index,
        match.index + match[0].length,
      );
    }
  }

  return [
    {
      targetUri: URI.file(tagEntryFile).toString(),
      targetRange: range,
      targetSelectionRange: range,
      originSelectionRange: root.markoAst.locationAt(node),
    },
  ];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
