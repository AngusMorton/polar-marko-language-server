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
  const templateDefinitions = provideTemplateDefinition(
    node,
    root,
    componentMeta,
  );

  if (!templateDefinitions?.length) {
    return tsDefinitions;
  }

  return tsDefinitions?.length
    ? [...templateDefinitions, ...tsDefinitions]
    : templateDefinitions;
}

function provideTemplateDefinition(
  node: ReturnType<MarkoVirtualCode["markoAst"]["nodeAt"]>,
  root: MarkoVirtualCode,
  componentMeta?: MarkoComponentMetaSession,
) {
  switch (node?.type) {
    case NodeType.AttrName:
      return provideAttrDefinition(node, root, componentMeta);
    case NodeType.OpenTagName:
      return provideTagDefinition(node, root, componentMeta);
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

  const identifierRange = identifierRangeAtOffset(root, offset);
  const generatedMatch = getBestGeneratedMatch(
    embedded,
    offset,
    identifierRange,
  );
  if (!generatedMatch) {
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
  const definitionAndBoundSpan: ts.DefinitionInfoAndBoundSpan | undefined =
    languageService.getDefinitionAndBoundSpan(fileName, generatedMatch.offset);
  if (!definitionAndBoundSpan) {
    return;
  }

  const definitions = definitionAndBoundSpan.definitions;
  if (!definitions?.length) {
    return;
  }

  const originSelectionRange = generatedMatch.identifierRange
    ? root.markoAst.locationAt(generatedMatch.identifierRange)
    : sourceRangeFromTextSpan(
        definitionAndBoundSpan.textSpan.start,
        definitionAndBoundSpan.textSpan.length,
        embedded,
      );

  return createTypeScriptDefinitionLinks(
    definitions,
    context,
    originSelectionRange,
  );
}

function createTypeScriptDefinitionLinks(
  definitions: readonly ts.DefinitionInfo[],
  context: LanguageServiceContext,
  originSelectionRange: LocationLink["originSelectionRange"],
) {
  return definitions.map((definition: ts.DefinitionInfo) => {
    const targetUri = URI.file(definition.fileName).toString();
    const range = definitionRangeFromTextSpan(
      definition.textSpan.start,
      definition.textSpan.length,
      definition.fileName,
      context,
    );

    return {
      targetUri,
      targetRange: range,
      targetSelectionRange: range,
      ...(originSelectionRange ? { originSelectionRange } : undefined),
    } satisfies LocationLink;
  });
}

function getBestGeneratedMatch(
  embedded: NonNullable<ReturnType<typeof getScriptCompletionDocument>>,
  offset: number,
  identifierRange: { start: number; end: number } | undefined,
) {
  let firstMatch: GeneratedMatch | undefined;
  let bestMatch: GeneratedMatch | undefined;

  for (const [mappedOffset, mapping] of embedded.map.toGeneratedLocation(
    offset,
    (data) => !!data.navigation,
  )) {
    firstMatch ??= { offset: mappedOffset };

    const sourceStart = mapping.sourceOffsets[0];
    const generatedStart = mapping.generatedOffsets[0];
    const length = mapping.lengths[0];
    if (
      sourceStart !== undefined &&
      length !== undefined &&
      offset >= sourceStart &&
      offset < sourceStart + length
    ) {
      if (
        identifierRange &&
        (sourceStart !== identifierRange.start ||
          length !== identifierRange.end - identifierRange.start)
      ) {
        continue;
      }

      return { offset: mappedOffset, identifierRange };
    }

    if (
      sourceStart === undefined ||
      generatedStart === undefined ||
      length === undefined
    ) {
      continue;
    }

    const sourceText = embedded.sourceDocument.getText({
      start: embedded.sourceDocument.positionAt(sourceStart),
      end: embedded.sourceDocument.positionAt(sourceStart + length),
    });
    const generatedText = embedded.document.getText({
      start: embedded.document.positionAt(generatedStart),
      end: embedded.document.positionAt(generatedStart + length),
    });

    if (sourceText === generatedText) {
      bestMatch = { offset: mappedOffset };
    }
  }

  if (!identifierRange) {
    return bestMatch ?? firstMatch;
  }

  const generatedIdentifier = embedded.sourceDocument.getText({
    start: embedded.sourceDocument.positionAt(identifierRange.start),
    end: embedded.sourceDocument.positionAt(identifierRange.end),
  });
  let fallbackMatch: GeneratedMatch | undefined;
  for (const [
    sourceStart,
    sourceEnd,
    startMapping,
  ] of embedded.map.toSourceRange(
    0,
    embedded.document.getText().length,
    false,
    (data) => !!data.navigation,
  )) {
    if (sourceEnd - sourceStart !== generatedIdentifier.length) {
      continue;
    }

    const sourceText = embedded.sourceDocument.getText({
      start: embedded.sourceDocument.positionAt(sourceStart),
      end: embedded.sourceDocument.positionAt(sourceEnd),
    });
    if (sourceText !== generatedIdentifier) {
      continue;
    }

    const generatedStart = startMapping.generatedOffsets[0];
    if (generatedStart === undefined) {
      continue;
    }

    const match = {
      offset: generatedStart,
      identifierRange: { start: sourceStart, end: sourceEnd },
    };
    if (sourceStart === identifierRange.start) {
      return match;
    }

    fallbackMatch ??= match;
  }

  return fallbackMatch;
}

interface GeneratedMatch {
  offset: number;
  identifierRange?: { start: number; end: number };
}

function identifierRangeAtOffset(root: MarkoVirtualCode, offset: number) {
  const code = root.code;
  const start = scanIdentifierStart(code, offset);
  if (start === undefined) {
    return;
  }

  let end = start;
  while (end < code.length && isIdentifierPart(code.charCodeAt(end))) {
    end++;
  }

  if (end <= start) {
    return;
  }

  return { start, end };
}

function sourceRangeFromTextSpan(
  start: number,
  length: number,
  embedded: NonNullable<ReturnType<typeof getScriptCompletionDocument>>,
) {
  for (const [sourceStart, sourceEnd] of embedded.map.toSourceRange(
    start,
    start + length,
    false,
    (data) => !!data.navigation,
  )) {
    return {
      start: embedded.sourceDocument.positionAt(sourceStart),
      end: embedded.sourceDocument.positionAt(sourceEnd),
    };
  }
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

function definitionRangeFromTextSpan(
  start: number,
  length: number,
  fileName: string,
  context: LanguageServiceContext,
) {
  const script = context.language.scripts.get(URI.file(fileName));
  if (script?.languageId === "marko") {
    const document = context.documents.get(
      script.id,
      script.languageId,
      script.snapshot,
    );
    const source = document?.getText();
    const narrowedRange = source
      ? getNarrowedDeclarationRange(source, start, start + length)
      : undefined;
    if (narrowedRange) {
      return narrowedRange;
    }
  }

  return rangeFromTextSpan(start, length, fileName, context);
}

function scanIdentifierStart(code: string, offset: number) {
  for (const candidate of [offset, offset - 1]) {
    if (candidate < 0 || candidate >= code.length) {
      continue;
    }

    const charCode = code.charCodeAt(candidate);
    if (!isIdentifierPart(charCode)) {
      continue;
    }

    let start = candidate;
    while (start > 0 && isIdentifierPart(code.charCodeAt(start - 1))) {
      start--;
    }

    return start;
  }
}

function isIdentifierPart(charCode: number) {
  return (
    (charCode >= 65 && charCode <= 90) ||
    (charCode >= 97 && charCode <= 122) ||
    (charCode >= 48 && charCode <= 57) ||
    charCode === 36 ||
    charCode === 95
  );
}

function provideAttrDefinition(
  node: Node.AttrName,
  root: MarkoVirtualCode,
  componentMeta?: MarkoComponentMetaSession,
): LocationLink[] | undefined {
  const tagName = node.parent.parent.nameText || "";
  const rawAttrName = root.markoAst.read(node);
  const attrName = rawAttrName.split(":", 1)[0]!;
  const inputMeta = getAttributeInputMeta(
    node,
    tagName,
    attrName,
    componentMeta,
  );
  const eventMeta = getAttributeEventMeta(
    node,
    tagName,
    attrName,
    componentMeta,
  );
  const metaDefinitions = (eventMeta ?? inputMeta)?.declarations
    .map((declaration) =>
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
    return metaDefinitions?.length ? metaDefinitions : undefined;
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
  const range = getDeclarationRange(
    source,
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

function getDeclarationRange(source: string, start: number, end: number) {
  const narrowedRange = getNarrowedDeclarationRange(source, start, end);
  if (narrowedRange) {
    return narrowedRange;
  }

  return getLocation(getLines(source), start, end);
}

function getNarrowedDeclarationRange(
  source: string,
  start: number,
  end: number,
) {
  const declarationSource = source.slice(start, end);
  const match =
    /\b(?:interface|type|class|function|const|let|var)\s+([A-Za-z_$][\w$]*)|\b([A-Za-z_$][\w$]*)\??\s*[:(]/.exec(
      declarationSource,
    );
  const keywordOnlyMatch =
    /^\s*(?:interface|type|class|function|const|let|var)\s*$/.exec(
      declarationSource,
    );
  if (keywordOnlyMatch) {
    const nameRange = getDeclarationNameAfterKeyword(source, end);
    if (nameRange) {
      return nameRange;
    }
  }

  const index =
    match?.[1] !== undefined
      ? match.index + match[0].lastIndexOf(match[1])
      : match?.[2] !== undefined
        ? match.index + match[0].lastIndexOf(match[2])
        : undefined;
  const name = match?.[1] ?? match?.[2];
  if (index === undefined || !name) {
    return;
  }

  return getLocation(
    getLines(source),
    start + index,
    start + index + name.length,
  );
}

function getDeclarationNameAfterKeyword(source: string, offset: number) {
  const afterMatch = /^\s*([A-Za-z_$][\w$]*)/.exec(source.slice(offset));
  if (!afterMatch?.[1]) {
    return;
  }

  const index = offset + afterMatch[0].lastIndexOf(afterMatch[1]);
  return getLocation(getLines(source), index, index + afterMatch[1].length);
}

function getAttributeInputMeta(
  node: Node.AttrName,
  tagName: string,
  attrName: string,
  componentMeta: MarkoComponentMetaSession | undefined,
) {
  const parentTag = node.parent.parent;
  if (parentTag.type === NodeType.AttrTag) {
    return parentTag.owner?.nameText
      ? componentMeta?.getAttrTagInputMetaForTag(
          parentTag.owner.nameText,
          parentTag.nameText,
          attrName,
        )
      : undefined;
  }

  return componentMeta?.getInputMetaForTag(tagName, attrName);
}

function getAttributeEventMeta(
  node: Node.AttrName,
  tagName: string,
  attrName: string,
  componentMeta: MarkoComponentMetaSession | undefined,
) {
  if (node.parent.parent.type === NodeType.AttrTag) {
    return;
  }

  return componentMeta?.getEventMetaForTag(tagName, attrName);
}

function provideTagDefinition(
  node: Node.OpenTagName,
  root: MarkoVirtualCode,
  componentMeta?: MarkoComponentMetaSession,
): LocationLink[] | undefined {
  const tag = node.parent;
  const tagName = tag.nameText || "";
  const attrTagDefinitions =
    tag.type === NodeType.AttrTag && tag.owner?.nameText
      ? componentMeta
          ?.getAttrTagMetaForTag(tag.owner.nameText, tag.nameText)
          ?.declarations.map((declaration) =>
            declarationToLocationLink(
              declaration,
              root.markoAst.locationAt(node),
            ),
          )
          .filter((link): link is LocationLink => !!link)
      : undefined;
  if (attrTagDefinitions?.length) {
    return attrTagDefinitions;
  }

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

  const componentLink = {
    targetUri: URI.file(tagEntryFile).toString(),
    targetRange: range,
    targetSelectionRange: range,
    originSelectionRange: root.markoAst.locationAt(node),
  } satisfies LocationLink;
  const inputLinks = componentMeta
    ?.getTagMetaForTag(tagName)
    ?.input?.declarations.map((declaration) =>
      declarationToLocationLink(declaration, root.markoAst.locationAt(node)),
    )
    .filter((link): link is LocationLink => !!link);

  return inputLinks?.length ? [componentLink, ...inputLinks] : [componentLink];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
