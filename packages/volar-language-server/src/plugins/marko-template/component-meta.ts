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
            [...tagNames].map((tagName) => loadTagMeta(tagName)),
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
        const normalizedTagName = normalizeTagName(tagName);
        if (tagMetaByName.has(normalizedTagName)) {
          return Promise.resolve();
        }

        let pending = pendingTagMetaByName.get(normalizedTagName);
        if (!pending) {
          const request = getComponentMetaRequest(root.code, normalizedTagName);
          pending = tsserver
            .getComponentMeta(
              root.fileName,
              request.tagName,
              request.tagFileName,
            )
            .then((meta) => {
              tagMetaByName.set(normalizedTagName, meta);
            })
            .catch(() => {
              tagMetaByName.set(normalizedTagName, undefined);
            })
            .finally(() => {
              pendingTagMetaByName.delete(normalizedTagName);
            });
          pendingTagMetaByName.set(normalizedTagName, pending);
        }

        return pending;
      }
    },
  } satisfies MarkoComponentMetaManager;
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
