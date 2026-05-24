import { MarkoVirtualCode } from "@marko/language-core";
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
import { CompletionItemKind, CompletionItemTag } from "vscode-languageserver";
import { URI } from "vscode-uri";

import {
  getEmbeddedDocument,
  getGeneratedPosition,
  getGeneratedRange,
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
    position: sourceDocument.positionAt(offset),
    node: root.markoAst.nodeAt(offset),
  };
}

export function isAttrNameCompletionContext(
  templateContext: MarkoTemplateContext,
) {
  return (
    templateContext.node?.type === NodeType.AttrName ||
    templateContext.node?.type === NodeType.AttrNamed
  );
}

export function isAttrValueCompletionContext(
  templateContext: MarkoTemplateContext,
) {
  return templateContext.node?.type === NodeType.AttrValue;
}

/**
 * Attribute value completions come from constrained value sets (enum/union
 * members), so render them as enum members instead of the HTML service's
 * default `Unit` kind, matching how TypeScript/Vue present literal choices.
 */
export function normalizeAttrValueCompletionKind(item: CompletionItem): void {
  item.kind = CompletionItemKind.EnumMember;
}

// Matches event-handler attribute names/snippets: native `onclick`, component
// `onSelect`/`on-select`, and the `on<event>` / `once<event>` binding snippets.
const EVENT_ATTR_NAME_REG = /^on[-<A-Za-z]/;

/**
 * Normalizes the kind of an attribute-name completion so every source (HTML
 * data provider, Marko component metadata, taglib) renders with the same
 * Vue-style icon: an event glyph for handlers, a keyword glyph for Marko
 * directives/modifiers, and a field glyph for ordinary props/attributes.
 */
export function normalizeAttrCompletionKind(item: CompletionItem): void {
  if (EVENT_ATTR_NAME_REG.test(item.label)) {
    item.kind = CompletionItemKind.Event;
  } else if (item.kind !== CompletionItemKind.Keyword) {
    item.kind = CompletionItemKind.Field;
  }
}

export function transformSourceCompletionList(
  context: LanguageServiceContext,
  sourceUri: URI,
  embeddedDocumentUri: string,
  sourceDocument: TextDocument,
  list: CompletionList | undefined,
) {
  if (!list) {
    return;
  }

  const decoded = context.decodeEmbeddedDocumentUri(
    URI.parse(embeddedDocumentUri),
  );
  const embeddedCodeId = decoded?.[1];
  if (!embeddedCodeId) {
    return list;
  }

  const embedded = getEmbeddedDocument(context, sourceUri, embeddedCodeId);
  if (!embedded) {
    return list;
  }

  return {
    ...list,
    items: list.items.map((item) =>
      transformCompletionItem(
        item,
        (range) => getGeneratedRange(context, sourceUri, embeddedCodeId, range),
        sourceDocument,
        context,
      ),
    ),
  } satisfies CompletionList;
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
      items.push(markDeprecatedCompletionItem(item));
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

const DEPRECATED_DOC_REG = /(?:^|\s)\*?@deprecated\b/i;

/**
 * Flags a completion whose documentation carries an `@deprecated` JSDoc tag so
 * editors render it with a strikethrough, matching how Vue surfaces deprecated
 * props/components.
 */
function markDeprecatedCompletionItem(item: CompletionItem): CompletionItem {
  if (item.tags?.includes(CompletionItemTag.Deprecated)) {
    return item;
  }

  const documentation =
    typeof item.documentation === "string"
      ? item.documentation
      : item.documentation?.value;
  if (!documentation || !DEPRECATED_DOC_REG.test(documentation)) {
    return item;
  }

  item.tags = [...(item.tags ?? []), CompletionItemTag.Deprecated];
  return item;
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
