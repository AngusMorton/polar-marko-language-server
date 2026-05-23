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
  const tagMetaByKey = new Map<string, TagMeta | undefined>();
  const pendingTagMetaByKey = new Map<string, Promise<void>>();

  return {
    prepare(root) {
      const loadedTagKeys = new Set<string>();

      return {
        async preloadTags(tagNames) {
          await Promise.all(
            [...tagNames].map((tagName) => loadTagMeta(tagName)),
          );
        },
        getTagMetaForTag(tagName) {
          return getSessionTagMeta(normalizeTagName(tagName));
        },
        getInputMetaForTag(tagName, attrName) {
          return getSessionTagMeta(
            normalizeTagName(tagName),
          )?.input?.props.find((input) => input.name === attrName);
        },
        getEventMetaForTag(tagName, eventName) {
          return getSessionTagMeta(
            normalizeTagName(tagName),
          )?.input?.events.find((event) => event.name === eventName);
        },
        getAttrTagMetaForTag(tagName, attrTagName) {
          return getSessionTagMeta(
            normalizeTagName(tagName),
          )?.input?.attrTags.find((attrTag) =>
            isAttrTagMatch(attrTag, attrTagName),
          );
        },
        getAttrTagInputMetaForTag(tagName, attrTagName, attrName) {
          return getSessionTagMeta(normalizeTagName(tagName))
            ?.input?.attrTags.find((attrTag) =>
              isAttrTagMatch(attrTag, attrTagName),
            )
            ?.props.find((input) => input.name === attrName);
        },
      } satisfies MarkoComponentMetaSession;

      function loadTagMeta(tagName: string) {
        const normalizedTagName = normalizeTagName(tagName);
        const cacheKey = getCacheKey(root, normalizedTagName);
        if (tagMetaByKey.has(cacheKey)) {
          loadedTagKeys.add(cacheKey);
          return Promise.resolve();
        }

        let pending = pendingTagMetaByKey.get(cacheKey);
        if (!pending) {
          const request = getComponentMetaRequest(root.code, normalizedTagName);
          pending = tsserver
            .getComponentMeta(
              root.fileName,
              request.tagName,
              request.tagFileName,
            )
            .then((meta) => {
              tagMetaByKey.set(cacheKey, meta);
              loadedTagKeys.add(cacheKey);
            })
            .catch(() => {
              tagMetaByKey.set(cacheKey, undefined);
              loadedTagKeys.add(cacheKey);
            })
            .finally(() => {
              pendingTagMetaByKey.delete(cacheKey);
            });
          pendingTagMetaByKey.set(cacheKey, pending);
        }

        return pending.then(() => {
          loadedTagKeys.add(cacheKey);
        });
      }

      function getSessionTagMeta(tagName: string) {
        const cacheKey = getCacheKey(root, tagName);
        return loadedTagKeys.has(cacheKey)
          ? tagMetaByKey.get(cacheKey)
          : undefined;
      }
    },
  } satisfies MarkoComponentMetaManager;
}

function getCacheKey(root: MarkoVirtualCode, tagName: string) {
  const request = getComponentMetaRequest(root.code, tagName);
  return [
    normalizeFileName(root.fileName),
    tagName,
    request.tagName,
    request.tagFileName ?? "",
  ].join("\0");
}

function normalizeFileName(fileName: string) {
  return fileName.replace(/\\/g, "/");
}

function normalizeTagName(tagName: string) {
  return tagName.split(":")[0]!;
}

function getComponentMetaRequest(source: string, tagName: string) {
  const imported = getImportedTag(source, tagName);
  if (imported) {
    return imported;
  }

  return { tagName };
}

function getImportedTag(source: string, tagName: string) {
  const importReg = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importReg.exec(source))) {
    if (match[1] !== tagName) {
      continue;
    }

    const specifier = match[2]!;
    const tagSpecifier = /^<([^>]+)>$/.exec(specifier);
    if (tagSpecifier) {
      return { tagName: tagSpecifier[1]! };
    }

    if (/\.marko(?:[?#].*)?$/.test(specifier)) {
      return { tagName, tagFileName: specifier };
    }
  }
}

function normalizeAttrTagName(attrTagName: string) {
  return attrTagName.split(":").pop()!;
}

function isAttrTagMatch(attrTag: AttrTagMeta, attrTagName: string) {
  attrTagName = normalizeAttrTagName(attrTagName);
  return attrTag.name === attrTagName || attrTag.propertyName === attrTagName;
}
