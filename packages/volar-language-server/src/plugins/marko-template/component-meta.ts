import type { InputMeta, TagMeta } from "@marko/component-meta";
import type { MarkoVirtualCode } from "@marko/language-core";
import type { LanguageServiceContext } from "@volar/language-service";

import type { MarkoTsServer } from "./tsserver";

export interface MarkoComponentMetaSession {
  preloadTags(tagNames: Iterable<string>): Promise<void>;
  getTagMetaForTag(tagName: string): TagMeta | undefined;
  getInputMetaForTag(tagName: string, attrName: string): InputMeta | undefined;
}

export interface MarkoComponentMetaManager {
  prepare(
    root: MarkoVirtualCode,
    context?: LanguageServiceContext,
  ): MarkoComponentMetaSession;
}

export function createComponentMetaManager(
  tsserver: MarkoTsServer,
): MarkoComponentMetaManager {
  return {
    prepare(root) {
      const tagMetaByName = new Map<string, TagMeta | undefined>();
      const pendingTagMetaByName = new Map<string, Promise<void>>();

      return {
        async preloadTags(tagNames) {
          await Promise.all(
            [...tagNames].map((tagName) => loadTagMeta(tagName)),
          );
        },
        getTagMetaForTag(tagName) {
          return tagMetaByName.get(tagName);
        },
        getInputMetaForTag(tagName, attrName) {
          return tagMetaByName
            .get(tagName)
            ?.inputs.find((input) => input.name === attrName);
        },
      } satisfies MarkoComponentMetaSession;

      function loadTagMeta(tagName: string) {
        if (tagMetaByName.has(tagName)) {
          return Promise.resolve();
        }

        let pending = pendingTagMetaByName.get(tagName);
        if (!pending) {
          pending = tsserver
            .getComponentMeta(root.fileName, tagName)
            .then((meta) => {
              tagMetaByName.set(tagName, meta);
            })
            .catch(() => {
              tagMetaByName.set(tagName, undefined);
            })
            .finally(() => {
              pendingTagMetaByName.delete(tagName);
            });
          pendingTagMetaByName.set(tagName, pending);
        }

        return pending;
      }
    },
  } satisfies MarkoComponentMetaManager;
}
