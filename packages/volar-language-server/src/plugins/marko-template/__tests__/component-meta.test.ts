import assert from "node:assert/strict";

import type { TagMeta } from "@marko/component-meta";
import type { MarkoVirtualCode } from "@marko/language-core";

import { createComponentMetaManager } from "../component-meta";

describe("marko-template component meta", () => {
  it("reuses loaded metadata across prepare calls", async () => {
    const calls: ComponentMetaCall[] = [];
    const manager = createComponentMetaManager({
      async getComponentMeta(fileName, tagName, tagFileName) {
        calls.push({ fileName, tagName, tagFileName });
        return createTagMeta(tagName);
      },
    });
    const root = createRoot("/project/index.marko", "<fancy-button />");

    await manager.prepare(root).preloadTags(["fancy-button"]);
    const secondSession = manager.prepare(root);
    await secondSession.preloadTags(["fancy-button"]);

    assert.equal(calls.length, 1);
    assert.equal(
      secondSession.getTagMetaForTag("fancy-button")?.file,
      "fancy-button.marko",
    );
  });

  it("only exposes metadata preloaded by the current session", async () => {
    const manager = createComponentMetaManager({
      async getComponentMeta(fileName, tagName) {
        return createTagMeta(tagName);
      },
    });
    const root = createRoot("/project/index.marko", "<fancy-button />");

    await manager.prepare(root).preloadTags(["fancy-button"]);
    const secondSession = manager.prepare(root);

    assert.equal(secondSession.getTagMetaForTag("fancy-button"), undefined);
  });

  it("deduplicates concurrent metadata loads", async () => {
    const calls: ComponentMetaCall[] = [];
    const pending = createDeferred<TagMeta | undefined>();
    const manager = createComponentMetaManager({
      getComponentMeta(fileName, tagName, tagFileName) {
        calls.push({ fileName, tagName, tagFileName });
        return pending.promise;
      },
    });
    const root = createRoot("/project/index.marko", "<fancy-button />");

    const firstLoad = manager.prepare(root).preloadTags(["fancy-button"]);
    const secondLoad = manager.prepare(root).preloadTags(["fancy-button"]);

    assert.equal(calls.length, 1);
    pending.resolve(createTagMeta("fancy-button"));
    await Promise.all([firstLoad, secondLoad]);

    assert.equal(
      manager.prepare(root).getTagMetaForTag("fancy-button"),
      undefined,
    );
  });

  it("exposes shared pending metadata to each loading session", async () => {
    const pending = createDeferred<TagMeta | undefined>();
    const manager = createComponentMetaManager({
      getComponentMeta() {
        return pending.promise;
      },
    });
    const root = createRoot("/project/index.marko", "<fancy-button />");
    const firstSession = manager.prepare(root);
    const secondSession = manager.prepare(root);

    const firstLoad = firstSession.preloadTags(["fancy-button"]);
    const secondLoad = secondSession.preloadTags(["fancy-button"]);

    pending.resolve(createTagMeta("fancy-button"));
    await Promise.all([firstLoad, secondLoad]);

    assert.equal(
      firstSession.getTagMetaForTag("fancy-button")?.file,
      "fancy-button.marko",
    );
    assert.equal(
      secondSession.getTagMetaForTag("fancy-button")?.file,
      "fancy-button.marko",
    );
  });

  it("separates the same local tag name by importer and import target", async () => {
    const calls: ComponentMetaCall[] = [];
    const manager = createComponentMetaManager({
      async getComponentMeta(fileName, tagName, tagFileName) {
        calls.push({ fileName, tagName, tagFileName });
        return createTagMeta(tagFileName ?? tagName);
      },
    });
    const firstRoot = createRoot(
      "/project/index.marko",
      'import Button from "./a.marko"\n<Button />',
    );
    const secondRoot = createRoot(
      "/project/index.marko",
      'import Button from "./b.marko"\n<Button />',
    );
    const thirdRoot = createRoot(
      "/project/other.marko",
      'import Button from "./a.marko"\n<Button />',
    );

    await manager.prepare(firstRoot).preloadTags(["Button"]);
    await manager.prepare(secondRoot).preloadTags(["Button"]);
    await manager.prepare(thirdRoot).preloadTags(["Button"]);

    assert.deepEqual(calls, [
      {
        fileName: "/project/index.marko",
        tagName: "Button",
        tagFileName: "./a.marko",
      },
      {
        fileName: "/project/index.marko",
        tagName: "Button",
        tagFileName: "./b.marko",
      },
      {
        fileName: "/project/other.marko",
        tagName: "Button",
        tagFileName: "./a.marko",
      },
    ]);
  });

  it("preserves imported tag-name requests", async () => {
    const calls: ComponentMetaCall[] = [];
    const manager = createComponentMetaManager({
      async getComponentMeta(fileName, tagName, tagFileName) {
        calls.push({ fileName, tagName, tagFileName });
        return createTagMeta(tagName);
      },
    });
    const root = createRoot(
      "/project/index.marko",
      'import Button from "<fancy-button>"\n<Button />',
    );

    await manager.prepare(root).preloadTags(["Button"]);

    assert.deepEqual(calls, [
      {
        fileName: "/project/index.marko",
        tagName: "fancy-button",
        tagFileName: undefined,
      },
    ]);
  });
});

interface ComponentMetaCall {
  fileName: string;
  tagName: string;
  tagFileName: string | undefined;
}

function createRoot(fileName: string, code: string) {
  return { fileName, code } as MarkoVirtualCode;
}

function createTagMeta(file: string) {
  return { file: `${file}.marko` } as TagMeta;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}
