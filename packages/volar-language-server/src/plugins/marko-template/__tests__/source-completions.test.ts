import assert from "node:assert/strict";

import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { provideSourceOnlyCompletions } from "../provideSourceOnlyCompletions";
import {
  createVirtualCode,
  fixturePath,
} from "../source-completions/__tests__/helpers";

describe("marko-template source completions", () => {
  it("keeps attr tag completions source-driven", () => {
    const fileName = fixturePath(
      "script",
      "attr-tag-target-property",
      "index.marko",
    );
    const source = "<test-tag>\n  <@█/>\n</test-tag>";
    const offset = source.indexOf("█");
    const content = source.replace("█", "");
    const { virtualCode } = createVirtualCode(fileName, source);
    const uri = URI.file(fileName).toString();
    const document = TextDocument.create(uri, "marko", 0, content);

    const completions = provideSourceOnlyCompletions({
      document,
      sourceUri: URI.file(fileName),
      root: virtualCode,
      offset,
      position: document.positionAt(offset),
      node: virtualCode.markoAst.nodeAt(offset),
    });

    assert(completions, "Expected source completions");
    assert(completions.items.some((item) => item.label === "@item"));
  });

  it("provides attr tag completions from component metadata", () => {
    const fileName = fixturePath("script", "tags-api-basic", "index.marko");
    const source = "<fancy-button>\n  <@█/>\n</fancy-button>";
    const offset = source.indexOf("█");
    const content = source.replace("█", "");
    const { virtualCode } = createVirtualCode(fileName, source);
    const uri = URI.file(fileName).toString();
    const document = TextDocument.create(uri, "marko", 0, content);

    const completions = provideSourceOnlyCompletions(
      {
        document,
        sourceUri: URI.file(fileName),
        root: virtualCode,
        offset,
        position: document.positionAt(offset),
        node: virtualCode.markoAst.nodeAt(offset),
      },
      {
        async preloadTags() {},
        getTagMetaForTag(tagName) {
          return tagName === "fancy-button"
            ? {
                input: {
                  attrTags: [
                    {
                      name: "icon",
                      required: false,
                      props: [{ name: "name" }],
                      events: [],
                    },
                  ],
                },
              }
            : undefined;
        },
      } as never,
    );

    assert(completions, "Expected source completions");
    assert(completions.items.some((item) => item.label === "@icon?"));
  });

  it("provides attr tag prop completions from owner component metadata", () => {
    const fileName = fixturePath("script", "tags-api-basic", "index.marko");
    const source = "<fancy-button><@icon na█/></fancy-button>";
    const offset = source.indexOf("█");
    const content = source.replace("█", "");
    const { virtualCode } = createVirtualCode(fileName, source);
    const uri = URI.file(fileName).toString();
    const document = TextDocument.create(uri, "marko", 0, content);

    const completions = provideSourceOnlyCompletions(
      {
        document,
        sourceUri: URI.file(fileName),
        root: virtualCode,
        offset,
        position: document.positionAt(offset),
        node: virtualCode.markoAst.nodeAt(offset),
      },
      {
        async preloadTags() {},
        getTagMetaForTag(tagName) {
          return tagName === "fancy-button"
            ? {
                input: {
                  props: [],
                  events: [],
                  attrTags: [
                    {
                      name: "icon",
                      required: false,
                      props: [
                        {
                          name: "name",
                          type: "string",
                          required: true,
                          description: "",
                          global: false,
                          tags: [],
                          schema: "string",
                          declarations: [],
                          getDeclarations() {
                            return [];
                          },
                          getTypeObject() {
                            return undefined as never;
                          },
                        },
                      ],
                      events: [],
                    },
                  ],
                },
              }
            : undefined;
        },
      } as never,
    );

    assert(completions, "Expected source completions");
    assert(completions.items.some((item) => item.label === "name"));
  });

  it("matches attr tag props by public name or target property", () => {
    const fileName = fixturePath(
      "script",
      "attr-tag-target-property",
      "index.marko",
    );
    const source = "<test-tag><@item x█/></test-tag>";
    const offset = source.indexOf("█");
    const content = source.replace("█", "");
    const { virtualCode } = createVirtualCode(fileName, source);
    const uri = URI.file(fileName).toString();
    const document = TextDocument.create(uri, "marko", 0, content);

    const completions = provideSourceOnlyCompletions(
      {
        document,
        sourceUri: URI.file(fileName),
        root: virtualCode,
        offset,
        position: document.positionAt(offset),
        node: virtualCode.markoAst.nodeAt(offset),
      },
      {
        async preloadTags() {},
        getTagMetaForTag(tagName) {
          return tagName === "test-tag"
            ? {
                input: {
                  props: [],
                  events: [],
                  attrTags: [
                    {
                      name: "item",
                      propertyName: "items",
                      required: true,
                      props: [
                        {
                          name: "x",
                          type: "number",
                          required: true,
                          description: "",
                          global: false,
                          tags: [],
                          schema: "number",
                          declarations: [],
                          getDeclarations() {
                            return [];
                          },
                          getTypeObject() {
                            return undefined as never;
                          },
                        },
                      ],
                      events: [],
                    },
                  ],
                },
              }
            : undefined;
        },
      } as never,
    );

    assert(completions, "Expected source completions");
    assert(completions.items.some((item) => item.label === "x"));
  });

  it("keeps attr modifier completions source-driven", () => {
    const fileName = fixturePath("script", "basic", "index.marko");
    const source = "<div id:s█/>";
    const offset = source.indexOf("█");
    const content = source.replace("█", "");
    const { virtualCode } = createVirtualCode(fileName, source);
    const uri = URI.file(fileName).toString();
    const document = TextDocument.create(uri, "marko", 0, content);

    const completions = provideSourceOnlyCompletions({
      document,
      sourceUri: URI.file(fileName),
      root: virtualCode,
      offset,
      position: document.positionAt(offset),
      node: virtualCode.markoAst.nodeAt(offset),
    });

    assert(completions, "Expected source completions");
    assert.deepEqual(
      completions.items.map((item) => item.label),
      ["scoped", "no-update"],
    );
  });
});
