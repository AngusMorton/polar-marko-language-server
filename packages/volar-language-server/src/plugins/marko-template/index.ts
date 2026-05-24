import type { MarkoVirtualCode } from "@marko/language-core";
import { NodeType } from "@marko/language-tools";
import type {
  CompletionItem,
  Hover,
  LanguageServiceContext,
  LanguageServicePlugin,
  LanguageServicePluginInstance,
  LocationLink,
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
import { provideDocumentSymbols as provideMarkoDocumentSymbols } from "./document-symbols";
import { provideHover } from "./hover";
import { getHoverNameNodeAtOffset } from "./hover-target";
import { createMarkoHtmlService } from "./html-service";
import {
  isSourceOnlyCompletionContext,
  provideSourceOnlyCompletions,
} from "./provideSourceOnlyCompletions";
import type { MarkoTsServer } from "./tsserver";
import {
  getMarkoCompletionData,
  getScriptCompletionDocument,
  isOpenTagNameCompletionContext,
  type MarkoTemplateContext,
  mergeCompletionLists,
  provideHtmlCompletionItems,
  provideScriptTagSymbolCompletions,
  resolveMarkoTemplateContext,
  transformSourceCompletionList,
} from "./util";
import { isHTML } from "./util/is-html";

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
      documentSymbolProvider: baseService.capabilities.documentSymbolProvider,
      hoverProvider: true,
      definitionProvider: true,
    },
    create(context): LanguageServicePluginInstance {
      const baseServiceInstance = baseService.create(context);

      return {
        async provideCompletionItems(document, position, completionContext) {
          const templateContext = resolveMarkoTemplateContext(
            context,
            document,
            position,
          );
          if (!templateContext) {
            return;
          }

          const completionMetaTagNames =
            getCompletionMetaTagNames(templateContext);
          const componentMetaSession = completionMetaTagNames.length
            ? componentMeta.prepare(templateContext.root, context)
            : undefined;
          if (componentMetaSession) {
            await componentMetaSession.preloadTags(completionMetaTagNames);
          }
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

          const htmlCompletion = isSourceOnlyCompletionContext(templateContext)
            ? undefined
            : await provideHtmlCompletionItems(
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
              );

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

          const definitionMetaTagNames =
            getDefinitionMetaTagNames(templateContext);
          const componentMetaSession = definitionMetaTagNames.length
            ? componentMeta.prepare(templateContext.root, context)
            : undefined;
          if (componentMetaSession) {
            await componentMetaSession.preloadTags(definitionMetaTagNames);
          }

          const definitions = provideDefinition(
            context,
            templateContext.root,
            templateContext.offset,
            templateContext.node,
            componentMetaSession,
          );

          return mapDefinitionOriginsToRequestDocument(
            context,
            document,
            templateContext,
            definitions,
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

          const decodedUri = context.decodeEmbeddedDocumentUri(
            URI.parse(document.uri),
          );

          if (
            !isTemplateHoverContext(templateContext) ||
            shouldSkipEmbeddedSourceHover(decodedUri, templateContext)
          ) {
            return;
          }

          const hoverMetaTagNames = getHoverMetaTagNames(templateContext);
          const componentMetaSession = hoverMetaTagNames.length
            ? componentMeta.prepare(templateContext.root, context)
            : undefined;
          if (componentMetaSession) {
            await componentMetaSession.preloadTags(hoverMetaTagNames);
          }

          if (!shouldUseHtmlHover(templateContext)) {
            return provideHover(
              templateContext,
              undefined,
              componentMetaSession,
            );
          }

          htmlService.updateCustomData(
            templateContext.root,
            context,
            componentMetaSession,
          );

          const htmlHover = (await baseServiceInstance.provideHover?.(
            templateContext.document,
            templateContext.position,
            {} as never,
          )) as Hover | null | undefined;
          if (
            !htmlHover &&
            decodedUri &&
            !shouldUseSourceHoverFallback(templateContext)
          ) {
            return;
          }

          return provideHover(templateContext, htmlHover);
        },
        provideDocumentSymbols(document) {
          const templateContext = resolveMarkoTemplateContext(
            context,
            document,
            document.positionAt(0),
          );
          if (!templateContext) {
            return;
          }

          const decoded = context.decodeEmbeddedDocumentUri(
            URI.parse(document.uri),
          );
          if (decoded && decoded[1] !== templateContext.root.id) {
            return;
          }

          return provideMarkoDocumentSymbols(templateContext.root);
        },
        async resolveCompletionItem(item) {
          const data = getMarkoCompletionData(item);
          if (!data) {
            return (
              (await Promise.resolve(
                baseServiceInstance.resolveCompletionItem?.(item, {} as never),
              )) ?? item
            );
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

function mapDefinitionOriginsToRequestDocument(
  context: LanguageServiceContext,
  document: Parameters<
    NonNullable<LanguageServicePluginInstance["provideDefinition"]>
  >[0],
  templateContext: MarkoTemplateContext,
  definitions: LocationLink[] | undefined,
) {
  if (!definitions?.length) {
    return definitions;
  }

  const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
  if (!decoded) {
    return definitions;
  }

  const sourceScript = context.language.scripts.get(decoded[0]);
  const embeddedCode = sourceScript?.generated?.embeddedCodes.get(decoded[1]);
  if (!sourceScript || !embeddedCode) {
    return definitions;
  }

  const map = context.language.maps.get(embeddedCode, sourceScript);
  return definitions.map((definition) => {
    const originSelectionRange = definition.originSelectionRange;
    if (!originSelectionRange) {
      return definition;
    }

    const sourceStart = templateContext.document.offsetAt(
      originSelectionRange.start,
    );
    const sourceEnd = templateContext.document.offsetAt(
      originSelectionRange.end,
    );
    const originLength = sourceEnd - sourceStart;
    for (const [generatedStart, generatedEnd] of map.toGeneratedRange(
      sourceStart,
      sourceEnd,
      false,
      (data) => !!data.navigation,
    )) {
      if (generatedEnd - generatedStart !== originLength) {
        continue;
      }

      return {
        ...definition,
        originSelectionRange: {
          start: document.positionAt(generatedStart),
          end: document.positionAt(generatedEnd),
        },
      };
    }

    const { originSelectionRange: _originSelectionRange, ...rest } = definition;
    return rest;
  });
}

function shouldUseHtmlHover(
  templateContext: ReturnType<
    typeof resolveMarkoTemplateContext
  > extends infer T
    ? Exclude<T, undefined>
    : never,
) {
  const { node, offset, root } = templateContext;
  const targetNode = getHoverNameNodeAtOffset(root, offset, node);

  if (!targetNode) {
    return false;
  }

  if (targetNode.type === NodeType.AttrName) {
    const tag = targetNode.parent.parent;
    return (
      tag.type === NodeType.Tag &&
      targetNode.parent.value?.type !== NodeType.AttrMethod &&
      !isModifierTarget(root, offset, targetNode)
    );
  }

  return targetNode.parent.type === NodeType.Tag;
}

function isTemplateHoverContext(
  templateContext: ReturnType<
    typeof resolveMarkoTemplateContext
  > extends infer T
    ? Exclude<T, undefined>
    : never,
) {
  return !!getHoverNameNodeAtOffset(
    templateContext.root,
    templateContext.offset,
    templateContext.node,
  );
}

function getCompletionMetaTagNames(templateContext: MarkoTemplateContext) {
  const { node, offset, root } = templateContext;
  if (node?.type === NodeType.OpenTagName) {
    const tag = node.parent;
    return tag.type === NodeType.AttrTag && tag.owner?.nameText
      ? [tag.owner.nameText]
      : [];
  }

  const attrNode = node?.type === NodeType.AttrName ? node : undefined;
  if (!attrNode) {
    return [];
  }

  const parentTag = attrNode.parent.parent;
  if (parentTag.type === NodeType.AttrTag) {
    return parentTag.owner?.nameText ? [parentTag.owner.nameText] : [];
  }

  if (
    parentTag.type === NodeType.Tag &&
    offset <= attrNode.end &&
    !isNativeHtmlTag(root, parentTag.nameText || "")
  ) {
    return parentTag.nameText ? [parentTag.nameText] : [];
  }

  return [];
}

function getDefinitionMetaTagNames(templateContext: MarkoTemplateContext) {
  return getConcreteMetaTagNames(templateContext, true);
}

function getHoverMetaTagNames(templateContext: MarkoTemplateContext) {
  return getConcreteMetaTagNames(
    templateContext,
    false,
    getHoverNameNodeAtOffset(
      templateContext.root,
      templateContext.offset,
      templateContext.node,
    ),
  );
}

function shouldUseSourceHoverFallback(
  templateContext: ReturnType<
    typeof resolveMarkoTemplateContext
  > extends infer T
    ? Exclude<T, undefined>
    : never,
) {
  const attrNode = getAttrNameNodeAtOffset(
    templateContext.root,
    templateContext.offset,
  );
  if (!attrNode) {
    return false;
  }

  const parentTag = attrNode.parent.parent;
  if (
    parentTag.type === NodeType.AttrTag ||
    attrNode.parent.value?.type === NodeType.AttrMethod
  ) {
    return true;
  }

  const rawName = templateContext.root.markoAst.read(attrNode);
  const modifierIndex = rawName.indexOf(":");
  return (
    modifierIndex !== -1 &&
    templateContext.offset > attrNode.start + modifierIndex
  );
}

function isModifierTarget(
  root: MarkoVirtualCode,
  offset: number,
  attrNode: Extract<
    NonNullable<MarkoTemplateContext["node"]>,
    { type: NodeType.AttrName }
  >,
) {
  const rawName = root.markoAst.read(attrNode);
  const modifierIndex = rawName.indexOf(":");
  return modifierIndex !== -1 && offset > attrNode.start + modifierIndex;
}

function shouldSkipEmbeddedSourceHover(
  decodedUri: ReturnType<LanguageServiceContext["decodeEmbeddedDocumentUri"]>,
  templateContext: ReturnType<
    typeof resolveMarkoTemplateContext
  > extends infer T
    ? Exclude<T, undefined>
    : never,
) {
  return (
    !!decodedUri &&
    decodedUri[1] !== templateContext.root.id &&
    !shouldUseSourceHoverFallback(templateContext)
  );
}

function getAttrNameNodeAtOffset(root: MarkoVirtualCode, offset: number) {
  const current = root.markoAst.nodeAt(offset);
  if (current?.type === NodeType.AttrName) {
    return current;
  }

  const previous = offset > 0 ? root.markoAst.nodeAt(offset - 1) : undefined;
  if (previous?.type === NodeType.AttrName && previous.end === offset) {
    return previous;
  }
}

function getConcreteMetaTagNames(
  templateContext: MarkoTemplateContext,
  requireCustomTag: boolean,
  targetNode = getNameNodeAtOffset(
    templateContext.root,
    templateContext.offset,
    templateContext.node,
  ),
) {
  const { root } = templateContext;

  if (targetNode?.type === NodeType.AttrName) {
    const tag = targetNode.parent.parent;
    if (tag.type === NodeType.AttrTag) {
      return tag.owner?.nameText ? [tag.owner.nameText] : [];
    }

    return getCustomTagMetaName(root, tag.nameText || "", requireCustomTag);
  }

  if (targetNode?.type === NodeType.OpenTagName) {
    const tag = targetNode.parent;
    if (tag.type === NodeType.AttrTag) {
      return tag.owner?.nameText ? [tag.owner.nameText] : [];
    }

    return getCustomTagMetaName(root, tag.nameText || "", requireCustomTag);
  }

  return [];
}

function getCustomTagMetaName(
  root: MarkoVirtualCode,
  tagName: string,
  requireCustomTag: boolean,
) {
  return tagName && (!requireCustomTag || !isNativeHtmlTag(root, tagName))
    ? [tagName]
    : [];
}

function getNameNodeAtOffset(
  root: MarkoVirtualCode,
  offset: number,
  node?: ReturnType<MarkoVirtualCode["markoAst"]["nodeAt"]>,
) {
  if (node?.type === NodeType.AttrName || node?.type === NodeType.OpenTagName) {
    return node;
  }

  const previous = offset > 0 ? root.markoAst.nodeAt(offset - 1) : undefined;
  if (
    (previous?.type === NodeType.AttrName ||
      previous?.type === NodeType.OpenTagName) &&
    previous.end === offset
  ) {
    return previous;
  }
}

function isNativeHtmlTag(root: MarkoVirtualCode, tagName: string) {
  return isLowercaseTagName(tagName) && isHTML(root.tagLookup.getTag(tagName));
}

function isLowercaseTagName(tagName: string) {
  return tagName === tagName.toLowerCase();
}
