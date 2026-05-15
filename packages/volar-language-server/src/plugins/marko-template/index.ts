import type { MarkoVirtualCode } from "@marko/language-core";
import { NodeType } from "@marko/language-tools";
import type {
  CompletionItem,
  DocumentLink,
  DocumentSymbol,
  Hover,
  LanguageServicePlugin,
  LanguageServicePluginInstance,
} from "@volar/language-service";
import { transformCompletionItem } from "@volar/language-service";
import { getFormatCodeSettings } from "volar-service-typescript/lib/configs/getFormatCodeSettings";
import { getUserPreferences } from "volar-service-typescript/lib/configs/getUserPreferences";
import { applyCompletionEntryDetails } from "volar-service-typescript/lib/utils/lspConverters";
import { URI } from "vscode-uri";

import { getSourceRange } from "../shared/marko-documents";
import {
  MARKO_SCRIPT_EMBEDDED_CODE_ID,
  MarkoCompletionKind,
} from "./completion-types";
import { createComponentMetaManager } from "./component-meta";
import { provideDefinition } from "./definition";
import { provideHover } from "./hover";
import { createMarkoHtmlService } from "./html-service";
import { provideSourceOnlyCompletions } from "./source-completions";
import type { MarkoTsServer } from "./tsserver";
import {
  getMarkoCompletionData,
  getScriptCompletionDocument,
  isOpenTagNameCompletionContext,
  mergeCompletionLists,
  provideHtmlCompletionItems,
  provideScriptTagSymbolCompletions,
  resolveMarkoTemplateContext,
  transformSourceCompletionList,
} from "./util";

export const create = (
  ts: typeof import("typescript"),
  tsserver: MarkoTsServer,
): LanguageServicePlugin => {
  const componentMeta = createComponentMetaManager(tsserver);
  const htmlService = createMarkoHtmlService(componentMeta);
  const baseService = htmlService.baseService;

  return {
    name: "marko-template",
    capabilities: {
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [
          ...new Set([
            ...htmlService.triggerCharacters,
            ">",
            "@",
            "/",
            "'",
            '"',
            "`",
            " ",
            "=",
            "*",
            "#",
            "$",
            "+",
            "^",
            "(",
            "[",
            "-",
          ]),
        ],
      },
      documentLinkProvider: baseService.capabilities.documentLinkProvider,
      documentSymbolProvider: baseService.capabilities.documentSymbolProvider,
      hoverProvider: true,
      definitionProvider: true,
    },
    create(context): LanguageServicePluginInstance {
      const baseServiceInstance = baseService.create(context);

      return {
        ...baseServiceInstance,
        async provideCompletionItems(document, position, completionContext) {
          const templateContext = resolveMarkoTemplateContext(
            context,
            document,
            position,
          );
          if (!templateContext) {
            return;
          }

          const componentMetaSession = componentMeta.prepare(
            templateContext.root,
            context,
          );
          await componentMetaSession.preloadTags(
            getRelevantTagNames(templateContext.root, templateContext.node),
          );
          htmlService.updateCustomData(
            templateContext.root,
            context,
            componentMetaSession,
          );

          const sourceOnlyCompletion = provideSourceOnlyCompletions(
            templateContext,
            componentMetaSession,
          );
          const transformedSourceOnlyCompletion = transformSourceCompletionList(
            context,
            templateContext.sourceUri,
            document.uri,
            templateContext.document,
            sourceOnlyCompletion,
          );

          const htmlCompletion = isOpenTagNameCompletionContext(templateContext)
            ? await provideHtmlCompletionItems(
                {
                  async provideCompletionItems(document, position, context) {
                    return (
                      (await Promise.resolve(
                        baseServiceInstance.provideCompletionItems?.(
                          document,
                          position,
                          context,
                          {} as never,
                        ),
                      )) ?? undefined
                    );
                  },
                },
                templateContext,
                completionContext,
              )
            : undefined;

          const tagSymbolCompletion = isOpenTagNameCompletionContext(
            templateContext,
          )
            ? provideScriptTagSymbolCompletions(
                ts,
                context,
                templateContext,
                completionContext,
              )
            : undefined;

          return mergeCompletionLists(
            transformedSourceOnlyCompletion,
            tagSymbolCompletion,
            htmlCompletion,
          );
        },
        async provideDefinition(document, position) {
          const templateContext = resolveMarkoTemplateContext(
            context,
            document,
            position,
          );
          if (!templateContext) {
            return;
          }

          const componentMetaSession = componentMeta.prepare(
            templateContext.root,
            context,
          );
          await componentMetaSession.preloadTags(
            getRelevantTagNames(templateContext.root, templateContext.node),
          );

          return provideDefinition(
            context,
            templateContext.root,
            templateContext.offset,
            templateContext.node,
            componentMetaSession,
          );
        },
        async provideHover(document, position) {
          const templateContext = resolveMarkoTemplateContext(
            context,
            document,
            position,
          );
          if (!templateContext) {
            return;
          }

          const componentMetaSession = componentMeta.prepare(
            templateContext.root,
            context,
          );
          await componentMetaSession.preloadTags(
            getRelevantTagNames(templateContext.root, templateContext.node),
          );
          htmlService.updateCustomData(
            templateContext.root,
            context,
            componentMetaSession,
          );

          if (!shouldUseHtmlHover(templateContext)) {
            return provideHover(
              templateContext,
              undefined,
              componentMetaSession,
            );
          }

          const htmlHover = (await baseServiceInstance.provideHover?.(
            document,
            position,
            {} as never,
          )) as Hover | null | undefined;
          return provideHover(templateContext, htmlHover, componentMetaSession);
        },
        async provideDocumentLinks(
          document,
          token,
        ): Promise<DocumentLink[] | undefined> {
          const templateContext = resolveMarkoTemplateContext(
            context,
            document,
            document.positionAt(0),
          );
          if (!templateContext) {
            return;
          }

          const componentMetaSession = componentMeta.prepare(
            templateContext.root,
            context,
          );
          await componentMetaSession.preloadTags(
            getRelevantTagNames(templateContext.root),
          );
          htmlService.updateCustomData(
            templateContext.root,
            context,
            componentMetaSession,
          );
          return (
            (await baseServiceInstance.provideDocumentLinks?.(
              document,
              token,
            )) ?? undefined
          );
        },
        async provideDocumentSymbols(
          document,
          token,
        ): Promise<DocumentSymbol[] | undefined> {
          const templateContext = resolveMarkoTemplateContext(
            context,
            document,
            document.positionAt(0),
          );
          if (!templateContext) {
            return;
          }

          const componentMetaSession = componentMeta.prepare(
            templateContext.root,
            context,
          );
          await componentMetaSession.preloadTags(
            getRelevantTagNames(templateContext.root),
          );
          htmlService.updateCustomData(
            templateContext.root,
            context,
            componentMetaSession,
          );
          return (
            (await baseServiceInstance.provideDocumentSymbols?.(
              document,
              token,
            )) ?? undefined
          );
        },
        async resolveCompletionItem(item) {
          const data = getMarkoCompletionData(item);
          if (!data) {
            return item;
          }

          if (data.kind !== MarkoCompletionKind.TagSymbol) {
            return item;
          }

          const original = data.original as {
            uri: string;
            fileName: string;
            offset: number;
            originalItem: {
              name: string;
              source?: string;
              data?: unknown;
              labelDetails?: CompletionItem["labelDetails"];
            };
          };
          const embeddedUri = URI.parse(original.uri);
          const embedded = getScriptCompletionDocument(
            context,
            context.decodeEmbeddedDocumentUri(embeddedUri)?.[0] ?? embeddedUri,
          );
          if (!embedded) {
            return item;
          }

          const tsPlugin = context.plugins.find(
            ([plugin]) => plugin.name === "typescript-semantic",
          )?.[1];
          const languageService =
            tsPlugin?.provide?.["typescript/languageService"]?.();
          const getDocumentUri = tsPlugin?.provide?.["typescript/documentUri"];
          if (!languageService || !getDocumentUri) {
            return item;
          }

          const [formatOptions, preferences] = await Promise.all([
            getFormatCodeSettings(context, embedded.document, undefined),
            getUserPreferences(context, embedded.document),
          ]);

          const details = languageService.getCompletionEntryDetails(
            original.fileName,
            original.offset,
            original.originalItem.name,
            formatOptions,
            original.originalItem.source,
            preferences,
            original.originalItem.data,
          );
          if (!details) {
            return item;
          }

          if (original.originalItem.labelDetails) {
            item.labelDetails ??= {};
            Object.assign(
              item.labelDetails,
              original.originalItem.labelDetails,
            );
          }

          applyCompletionEntryDetails(
            ts,
            item,
            details,
            embedded.document,
            (fileName) => URI.parse(getDocumentUri(fileName)),
            (uri) =>
              context.documents.get(
                uri,
                embedded.embeddedCode.languageId,
                embedded.embeddedCode.snapshot,
              ),
          );

          item =
            transformCompletionItem(
              item,
              (range) =>
                getSourceRange(
                  context,
                  embedded.sourceScript.id,
                  MARKO_SCRIPT_EMBEDDED_CODE_ID,
                  range,
                ),
              embedded.document,
              context,
            ) ?? item;

          item.data = {
            ...data,
          };
          return item;
        },
        dispose() {
          baseServiceInstance.dispose?.();
        },
      };
    },
  };
};

function shouldUseHtmlHover(
  templateContext: ReturnType<
    typeof resolveMarkoTemplateContext
  > extends infer T
    ? Exclude<T, undefined>
    : never,
) {
  const { node, offset, root } = templateContext;
  let targetNode =
    node?.type === NodeType.AttrName || node?.type === NodeType.OpenTagName
      ? node
      : undefined;

  if (!targetNode && offset > 0) {
    const previous = root.markoAst.nodeAt(offset - 1);
    if (
      (previous?.type === NodeType.AttrName ||
        previous?.type === NodeType.OpenTagName) &&
      previous.end === offset
    ) {
      targetNode = previous;
    }
  }

  if (!targetNode) {
    return false;
  }

  if (targetNode.type === NodeType.AttrName) {
    return true;
  }

  if (
    targetNode.type !== NodeType.OpenTagName ||
    targetNode.parent.type !== NodeType.Tag
  ) {
    return false;
  }

  return !/^[A-Z]/.test(targetNode.parent.nameText || "");
}

function getRelevantTagNames(
  root: MarkoVirtualCode,
  node?: ReturnType<MarkoVirtualCode["markoAst"]["nodeAt"]>,
) {
  const tagName =
    node?.type === NodeType.AttrName
      ? node.parent.parent.nameText
      : node?.type === NodeType.OpenTagName
        ? node.parent.nameText
        : undefined;

  if (tagName) {
    return [tagName];
  }

  return root.tagLookup
    .getTagsSorted()
    .filter((tag) => !tag.html)
    .map((tag) => tag.name);
}
