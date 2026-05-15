import type { MarkoVirtualCode } from "@marko/language-core";
import type {
  LanguageServiceContext,
  LanguageServicePlugin,
} from "@volar/language-service";
import {
  create as createHtmlService,
  resolveReference,
} from "volar-service-html";
import type * as html from "vscode-html-languageservice";
import { URI } from "vscode-uri";

import type {
  MarkoComponentMetaManager,
  MarkoComponentMetaSession,
} from "./component-meta";
import { createMarkoDataProvider } from "./data-provider";

export function createMarkoHtmlService(
  componentMetaManager?: MarkoComponentMetaManager,
) {
  let htmlData: html.IHTMLDataProvider[] = [];
  let currentRoot: MarkoVirtualCode | undefined;
  let currentContext: LanguageServiceContext | undefined;
  let currentComponentMeta: MarkoComponentMetaSession | undefined;
  const listeners = new Set<() => void>();

  const baseService = createHtmlService({
    documentSelector: ["marko"],
    useDefaultDataProvider: true,
    getDocumentContext(context) {
      return {
        resolveReference(ref, base) {
          let baseUri = URI.parse(base);
          const decoded = context.decodeEmbeddedDocumentUri(baseUri);
          if (decoded) {
            baseUri = decoded[0];
          }

          return resolveReference(ref, baseUri, context.env.workspaceFolders);
        },
      };
    },
    async getCustomData() {
      return htmlData;
    },
    onDidChangeCustomData(listener) {
      listeners.add(listener);
      return {
        dispose() {
          listeners.delete(listener);
        },
      };
    },
  });

  return {
    baseService,
    triggerCharacters:
      baseService.capabilities.completionProvider?.triggerCharacters ?? [],
    updateCustomData(
      root: MarkoVirtualCode,
      context?: LanguageServiceContext,
      componentMeta?: MarkoComponentMetaSession,
    ) {
      if (
        currentRoot === root &&
        currentContext === context &&
        currentComponentMeta === componentMeta
      ) {
        return;
      }

      currentRoot = root;
      currentContext = context;
      currentComponentMeta = componentMeta;
      htmlData = [
        createMarkoDataProvider(
          root,
          componentMetaManager,
          context,
          componentMeta,
        ),
      ];
      listeners.forEach((listener) => listener());
    },
  } satisfies {
    baseService: LanguageServicePlugin;
    triggerCharacters: string[];
    updateCustomData(
      root: MarkoVirtualCode,
      context?: LanguageServiceContext,
      componentMeta?: MarkoComponentMetaSession,
    ): void;
  };
}
