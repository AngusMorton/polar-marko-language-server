import assert from "node:assert/strict";

import type { MarkoVirtualCode } from "@marko/language-core";
import type { LanguageServiceContext } from "@volar/language-service";

import type { MarkoComponentMetaSession } from "../component-meta";
import { createMarkoHtmlService } from "../html-service";

describe("marko-template html service", () => {
  it("does not notify custom data listeners for unchanged effective state", () => {
    const root = createRoot();
    const context = {} as LanguageServiceContext;
    const componentMeta = createComponentMeta();
    const htmlService = createMarkoHtmlService();
    let notifications = 0;
    htmlService.onDidChangeCustomData(() => notifications++);

    htmlService.updateCustomData(root, context, componentMeta);
    htmlService.updateCustomData(root, context, componentMeta);

    assert.equal(notifications, 1);
  });

  it("notifies when component metadata backing version changes", () => {
    const root = createRoot();
    const context = {} as LanguageServiceContext;
    const componentMeta = createComponentMeta();
    const htmlService = createMarkoHtmlService();
    let notifications = 0;
    htmlService.onDidChangeCustomData(() => notifications++);

    htmlService.updateCustomData(root, context, componentMeta);
    componentMeta.advanceVersion();
    htmlService.updateCustomData(root, context, componentMeta);

    assert.equal(notifications, 2);
  });
});

function createRoot() {
  return { fileName: "/project/index.marko", code: "" } as MarkoVirtualCode;
}

function createComponentMeta() {
  const backing = { version: 0 };

  return {
    cacheIdentity: backing,
    get cacheVersion() {
      return backing.version;
    },
    advanceVersion() {
      backing.version++;
    },
    async preloadTags() {},
    getTagMetaForTag() {
      return undefined;
    },
    getInputMetaForTag() {
      return undefined;
    },
    getEventMetaForTag() {
      return undefined;
    },
    getAttrTagMetaForTag() {
      return undefined;
    },
    getAttrTagInputMetaForTag() {
      return undefined;
    },
  } satisfies MarkoComponentMetaSession & { advanceVersion(): void };
}
