import type {
  AttrTagMeta,
  EventMeta,
  InputMeta,
  TagMeta,
} from "@marko/component-meta";
import type { MarkoVirtualCode } from "@marko/language-core";
import type { LanguageServiceContext } from "@volar/language-service";

import type { MarkoTsServer } from "./tsserver";

export interface MarkoComponentMetaSession {
  preloadTags(tagNames: Iterable<string>): Promise<void>;
  getTagMetaForTag(tagName: string): TagMeta | undefined;
  getInputMetaForTag(tagName: string, attrName: string): InputMeta | undefined;
  getEventMetaForTag(tagName: string, eventName: string): EventMeta | undefined;
  getAttrTagMetaForTag(
    tagName: string,
    attrTagName: string,
  ): AttrTagMeta | undefined;
  getAttrTagInputMetaForTag(
    tagName: string,
    attrTagName: string,
    attrName: string,
  ): InputMeta | undefined;
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
            [...tagNames].map((tagName) =>
              loadTagMeta(normalizeTagName(tagName)),
            ),
          );
        },
        getTagMetaForTag(tagName) {
          return tagMetaByName.get(normalizeTagName(tagName));
        },
        getInputMetaForTag(tagName, attrName) {
          return tagMetaByName
            .get(normalizeTagName(tagName))
            ?.input?.props.find((input) => input.name === attrName);
        },
        getEventMetaForTag(tagName, eventName) {
          return tagMetaByName
            .get(normalizeTagName(tagName))
            ?.input?.events.find((event) => event.name === eventName);
        },
        getAttrTagMetaForTag(tagName, attrTagName) {
          return tagMetaByName
            .get(normalizeTagName(tagName))
            ?.input?.attrTags.find((attrTag) =>
              isAttrTagMatch(attrTag, attrTagName),
            );
        },
        getAttrTagInputMetaForTag(tagName, attrTagName, attrName) {
          return tagMetaByName
            .get(normalizeTagName(tagName))
            ?.input?.attrTags.find((attrTag) =>
              isAttrTagMatch(attrTag, attrTagName),
            )
            ?.props.find((input) => input.name === attrName);
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

function normalizeTagName(tagName: string) {
  return tagName.split(":")[0]!;
}

function normalizeAttrTagName(attrTagName: string) {
  return attrTagName.split(":").pop()!;
}

function isAttrTagMatch(attrTag: AttrTagMeta, attrTagName: string) {
  attrTagName = normalizeAttrTagName(attrTagName);
  return attrTag.name === attrTagName || attrTag.propertyName === attrTagName;
}
