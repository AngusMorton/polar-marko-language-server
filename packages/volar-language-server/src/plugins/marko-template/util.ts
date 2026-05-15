import { NodeType } from "@marko/language-tools";
import type {
  CompletionContext,
  CompletionItem,
  CompletionList,
  LanguageServiceContext,
  Position,
  TextDocument,
} from "@volar/language-service";
import { transformCompletionItem } from "@volar/language-service";
import { convertCompletionInfo } from "volar-service-typescript/lib/utils/lspConverters";
import { URI } from "vscode-uri";

import { MarkoVirtualCode } from "../../language";
import {
  getEmbeddedDocument,
  getGeneratedPosition,
  resolveMarkoCode,
  resolveSourceMarkoOffset,
} from "../shared/marko-documents";
import {
  isMarkoCompletionData,
  MARKO_HTML_EMBEDDED_CODE_ID,
  MARKO_SCRIPT_EMBEDDED_CODE_ID,
  MARKO_TEMPLATE_SOURCE,
  type MarkoCompletionData,
  MarkoCompletionKind,
} from "./completion-types";

export type MarkoTemplateContext = {
  document: TextDocument;
  sourceUri: URI;
  root: MarkoVirtualCode;
  offset: number;
  position: Position;
  node: ReturnType<MarkoVirtualCode["markoAst"]["nodeAt"]>;
};

export function isOpenTagNameCompletionContext(
  templateContext: MarkoTemplateContext,
) {
  const { node, offset } = templateContext;
  return (
    node?.type === NodeType.OpenTagName &&
    offset >= node.start &&
    offset <= node.end &&
    node.parent.type === NodeType.Tag
  );
}

export function resolveMarkoTemplateContext(
  context: LanguageServiceContext,
  document: TextDocument,
  position: Position,
): MarkoTemplateContext | undefined {
  const uri = URI.parse(document.uri);
  const info = resolveMarkoCode(context, document.uri);
  const sourceOffset = resolveSourceMarkoOffset(context, document, position);
  const sourceUri = context.decodeEmbeddedDocumentUri(uri)?.[0] ?? uri;
  const sourceScript = context.language.scripts.get(sourceUri);
  const root = info?.root ?? sourceScript?.generated?.root;

  if (!(root instanceof MarkoVirtualCode) || !sourceScript || !sourceOffset) {
    return;
  }

  const sourceDocument = context.documents.get(
    sourceScript.id,
    sourceScript.languageId,
    sourceScript.snapshot,
  );
  const offset = sourceOffset.offset;

  return {
    document: sourceDocument,
    sourceUri,
    root,
    offset,
    position,
    node: root.markoAst.nodeAt(offset),
  };
}

export async function provideHtmlCompletionItems(
  htmlService: {
    provideCompletionItems?(
      document: TextDocument,
      position: Position,
      completionContext: CompletionContext,
    ): Promise<CompletionList | undefined> | CompletionList | undefined;
  },
  templateContext: MarkoTemplateContext,
  completionContext: CompletionContext,
) {
  const list = await htmlService.provideCompletionItems?.(
    templateContext.document,
    templateContext.position,
    completionContext,
  );
  if (!list?.items.length) {
    return;
  }

  for (const item of list.items) {
    const documentation =
      typeof item.documentation === "string"
        ? item.documentation
        : item.documentation?.value;

    if (
      documentation?.includes("Custom Marko tag discovered") ||
      documentation?.includes("Core Marko")
    ) {
      item.kind = 7;
      item.sortText = `0${getCompletionInsertText(item)}`;
    }

    item.data = {
      source: MARKO_TEMPLATE_SOURCE,
      kind: MarkoCompletionKind.Html,
    } satisfies MarkoCompletionData;
  }

  return list;
}

export function provideScriptTagSymbolCompletions(
  tsModule: typeof import("typescript"),
  context: LanguageServiceContext,
  templateContext: MarkoTemplateContext,
  completionContext: CompletionContext,
) {
  const embedded = getGeneratedPosition(
    context,
    templateContext.sourceUri,
    MARKO_SCRIPT_EMBEDDED_CODE_ID,
    templateContext.position,
  );
  if (!embedded) {
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
  const offset = embedded.document.offsetAt(embedded.position);
  const info = languageService.getCompletionsAtPosition(fileName, offset, {
    triggerCharacter: completionContext.triggerCharacter,
    triggerKind: completionContext.triggerKind,
  });
  if (!info) {
    return;
  }

  const list = convertCompletionInfo(
    tsModule,
    info,
    embedded.document,
    embedded.position,
    (entry) =>
      ({
        source: MARKO_TEMPLATE_SOURCE,
        kind: MarkoCompletionKind.TagSymbol,
        embeddedCodeId: MARKO_SCRIPT_EMBEDDED_CODE_ID,
        original: {
          uri: embedded.document.uri,
          fileName,
          offset,
          originalItem: {
            name: entry.name,
            source: entry.source,
            data: entry.data,
            labelDetails: entry.labelDetails,
          },
        },
      }) satisfies MarkoCompletionData,
  );

  const items = list.items
    .filter((item) => isTagSymbolCompletionItem(item))
    .map((item) =>
      transformScriptCompletionItem(
        context,
        templateContext.sourceUri,
        embedded.document,
        item,
      ),
    )
    .filter((item): item is CompletionItem => !!item);

  if (!items.length) {
    return;
  }

  return {
    isIncomplete: list.isIncomplete,
    items,
  } satisfies CompletionList;
}

export function mergeCompletionLists(
  ...lists: Array<CompletionList | undefined>
): CompletionList | undefined {
  const items: CompletionItem[] = [];
  const seen = new Set<string>();
  let isIncomplete = false;

  for (const list of lists) {
    if (!list) continue;
    isIncomplete ||= list.isIncomplete;

    for (const item of list.items) {
      const key = getCompletionKey(item);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      items.push(item);
    }
  }

  if (!items.length) {
    return;
  }

  return {
    isIncomplete,
    items,
  };
}

export function getMarkoCompletionData(item: CompletionItem) {
  return isMarkoCompletionData(item.data) ? item.data : undefined;
}

export function getScriptCompletionDocument(
  context: LanguageServiceContext,
  sourceUri: URI,
) {
  return getEmbeddedDocument(context, sourceUri, MARKO_SCRIPT_EMBEDDED_CODE_ID);
}

export function getHtmlEmbeddedDocument(
  context: LanguageServiceContext,
  sourceUri: URI,
) {
  return getEmbeddedDocument(context, sourceUri, MARKO_HTML_EMBEDDED_CODE_ID);
}

function transformScriptCompletionItem(
  context: LanguageServiceContext,
  sourceUri: URI,
  embeddedDocument: TextDocument,
  item: CompletionItem,
) {
  const embedded = getEmbeddedDocument(
    context,
    sourceUri,
    MARKO_SCRIPT_EMBEDDED_CODE_ID,
  );
  if (!embedded) {
    return;
  }

  const transformed = transformCompletionItem(
    item,
    (range) => {
      const start = embedded.document.offsetAt(range.start);
      const end = embedded.document.offsetAt(range.end);
      for (const [sourceStart, sourceEnd] of embedded.map.toSourceRange(
        start,
        end,
        true,
        (data) => !!data.completion,
      )) {
        return {
          start: embedded.sourceDocument.positionAt(sourceStart),
          end: embedded.sourceDocument.positionAt(sourceEnd),
        };
      }
    },
    embeddedDocument,
    context,
  );
  if (!transformed) {
    return;
  }

  transformed.kind = 7;
  transformed.sortText = `0${getCompletionInsertText(transformed)}`;
  return transformed;
}

function isTagSymbolCompletionItem(item: CompletionItem) {
  return /^[A-Z][\w$]*$/.test(String(item.label));
}

function getCompletionKey(item: CompletionItem) {
  return `${item.label}::${getCompletionInsertText(item)}`;
}

function getCompletionInsertText(item: CompletionItem) {
  if (item.textEdit) {
    return item.textEdit.newText;
  }

  return item.insertText ?? String(item.label);
}
