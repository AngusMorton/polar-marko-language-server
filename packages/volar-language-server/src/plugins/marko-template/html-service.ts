import type { LanguageServicePlugin } from "@volar/language-service";
import {
  create as createHtmlService,
  resolveReference,
} from "volar-service-html";
import type * as html from "vscode-html-languageservice";
import { URI } from "vscode-uri";

import type { MarkoVirtualCode } from "../../language";
import type { MarkoComponentMetaManager } from "./component-meta";
import { createMarkoDataProvider } from "./data-provider";

export function createMarkoHtmlService(
  componentMetaManager?: MarkoComponentMetaManager,
) {
  let htmlData: html.IHTMLDataProvider[] = [];
  let currentRoot: MarkoVirtualCode | undefined;
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
    updateCustomData(root: MarkoVirtualCode) {
      if (currentRoot === root) {
        return;
      }

      currentRoot = root;
      htmlData = [createMarkoDataProvider(root, componentMetaManager)];
      listeners.forEach((listener) => listener());
    },
  } satisfies {
    baseService: LanguageServicePlugin;
    triggerCharacters: string[];
    updateCustomData(root: MarkoVirtualCode): void;
  };
}
