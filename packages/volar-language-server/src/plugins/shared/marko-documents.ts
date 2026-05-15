import { MarkoVirtualCode } from "@marko/language-core";
import type {
  LanguageServiceContext,
  Position,
  Range,
  TextDocument,
} from "@volar/language-service";
import { URI } from "vscode-uri";

export function resolveMarkoCode(
  context: LanguageServiceContext,
  documentUri: string,
) {
  const uri = URI.parse(documentUri);
  const decoded = context.decodeEmbeddedDocumentUri(uri);

  if (!decoded) {
    const sourceScript = context.language.scripts.get(uri);
    const root = sourceScript?.generated?.root;
    if (sourceScript && root instanceof MarkoVirtualCode) {
      return { sourceScript, root };
    }
    return;
  }

  const sourceScript = context.language.scripts.get(decoded[0]);
  const root = sourceScript?.generated?.root;
  if (!sourceScript || !(root instanceof MarkoVirtualCode)) {
    return;
  }

  if (decoded[1] === root.id) {
    return { sourceScript, root };
  }

  const embeddedCode = sourceScript.generated?.embeddedCodes.get(decoded[1]);
  if (embeddedCode) {
    return { sourceScript, root, embeddedCode };
  }
}

export function resolveSourceMarkoOffset(
  context: LanguageServiceContext,
  document: TextDocument,
  position: Position,
) {
  const info = resolveMarkoCode(context, document.uri);
  if (!info) return;

  if (!info.embeddedCode) {
    return { virtualCode: info.root, offset: document.offsetAt(position) };
  }

  const map = context.language.maps.get(info.embeddedCode, info.sourceScript);
  const embeddedOffset = document.offsetAt(position);
  let bestSourceOffset: number | undefined;

  for (const candidateOffset of [embeddedOffset, embeddedOffset - 1]) {
    if (candidateOffset < 0) {
      continue;
    }

    for (const [sourceOffset] of map.toSourceLocation(candidateOffset)) {
      bestSourceOffset = Math.max(
        bestSourceOffset ?? sourceOffset,
        sourceOffset,
      );
    }
  }

  if (bestSourceOffset !== undefined) {
    return { virtualCode: info.root, offset: bestSourceOffset };
  }
}

export function getEmbeddedDocument(
  context: LanguageServiceContext,
  sourceUri: URI,
  embeddedCodeId: string,
) {
  const sourceScript = context.language.scripts.get(sourceUri);
  const embeddedCode =
    sourceScript?.generated?.embeddedCodes.get(embeddedCodeId);

  if (!sourceScript || !embeddedCode) {
    return;
  }

  const documentUri = context.encodeEmbeddedDocumentUri(
    sourceScript.id,
    embeddedCode.id,
  );
  const document = context.documents.get(
    documentUri,
    embeddedCode.languageId,
    embeddedCode.snapshot,
  );
  const map = context.language.maps.get(embeddedCode, sourceScript);
  const sourceDocument = context.documents.get(
    sourceScript.id,
    sourceScript.languageId,
    sourceScript.snapshot,
  );

  return {
    sourceScript,
    embeddedCode,
    document,
    map,
    sourceDocument,
  };
}

export function getGeneratedPosition(
  context: LanguageServiceContext,
  sourceUri: URI,
  embeddedCodeId: string,
  position: Position,
) {
  const embedded = getEmbeddedDocument(context, sourceUri, embeddedCodeId);
  if (!embedded) {
    return;
  }

  const sourceOffset = embedded.sourceDocument.offsetAt(position);
  for (const [generatedOffset] of embedded.map.toGeneratedLocation(
    sourceOffset,
    (data) => !!data.completion,
  )) {
    return {
      ...embedded,
      position: embedded.document.positionAt(generatedOffset),
    };
  }
}

export function getSourceRange(
  context: LanguageServiceContext,
  sourceUri: URI,
  embeddedCodeId: string,
  range: Range,
) {
  const embedded = getEmbeddedDocument(context, sourceUri, embeddedCodeId);
  if (!embedded) {
    return;
  }

  const start = embedded.document.offsetAt(range.start);
  const end = embedded.document.offsetAt(range.end);

  for (const [sourceStart, sourceEnd] of embedded.map.toSourceRange(
    start,
    end,
    false,
    (data) => !!data.completion,
  )) {
    return {
      start: embedded.sourceDocument.positionAt(sourceStart),
      end: embedded.sourceDocument.positionAt(sourceEnd),
    };
  }
}

export function getGeneratedRange(
  context: LanguageServiceContext,
  sourceUri: URI,
  embeddedCodeId: string,
  range: Range,
) {
  const embedded = getEmbeddedDocument(context, sourceUri, embeddedCodeId);
  if (!embedded) {
    return;
  }

  const start = embedded.sourceDocument.offsetAt(range.start);
  const end = embedded.sourceDocument.offsetAt(range.end);

  for (const [generatedStart, generatedEnd] of embedded.map.toGeneratedRange(
    start,
    end,
    true,
    (data) => !!data.completion,
  )) {
    return {
      start: embedded.document.positionAt(generatedStart),
      end: embedded.document.positionAt(generatedEnd),
    };
  }
}
