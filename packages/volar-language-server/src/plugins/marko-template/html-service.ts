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
import { getDefaultHTMLDataProvider } from "vscode-html-languageservice";
import { URI } from "vscode-uri";

import type {
  MarkoComponentMetaManager,
  MarkoComponentMetaSession,
} from "./component-meta";
import {
  getComponentMetaCacheIdentity,
  getComponentMetaCacheVersion,
} from "./component-meta";
import { createMarkoDataProvider } from "./data-provider";

export function createMarkoHtmlService(
  componentMetaManager?: MarkoComponentMetaManager,
) {
  let htmlData: html.IHTMLDataProvider[] = [getDefaultHTMLDataProvider()];
  let currentRoot: MarkoVirtualCode | undefined;
  let currentContext: LanguageServiceContext | undefined;
  let currentComponentMeta: object | undefined;
  let currentComponentMetaVersion = 0;
  const listeners = new Set<() => void>();

  const baseService = createHtmlService({
    documentSelector: ["marko"],
    useDefaultDataProvider: false,
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
    async getCustomData() {
      return htmlData;
    },
    onDidChangeCustomData(listener: () => void) {
      listeners.add(listener);
      return {
        dispose() {
          listeners.delete(listener);
        },
      };
    },
    updateCustomData(
      root: MarkoVirtualCode,
      context?: LanguageServiceContext,
      componentMeta?: MarkoComponentMetaSession,
    ) {
      const componentMetaIdentity =
        getComponentMetaCacheIdentity(componentMeta);
      const componentMetaVersion = getComponentMetaCacheVersion(componentMeta);
      if (
        currentRoot === root &&
        currentContext === context &&
        currentComponentMeta === componentMetaIdentity &&
        currentComponentMetaVersion === componentMetaVersion
      ) {
        return;
      }

      currentRoot = root;
      currentContext = context;
      currentComponentMeta = componentMetaIdentity;
      currentComponentMetaVersion = componentMetaVersion;
      htmlData = [
        createMarkoDataProvider(
          root,
          componentMetaManager,
          context,
          componentMeta,
        ),
        getDefaultHTMLDataProvider(),
      ];
      listeners.forEach((listener) => listener());
    },
  } satisfies {
    baseService: LanguageServicePlugin;
    triggerCharacters: string[];
    getCustomData(): Promise<html.IHTMLDataProvider[]>;
    onDidChangeCustomData(listener: () => void): { dispose(): void };
    updateCustomData(
      root: MarkoVirtualCode,
      context?: LanguageServiceContext,
      componentMeta?: MarkoComponentMetaSession,
    ): void;
  };
}
