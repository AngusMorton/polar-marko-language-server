import assert from "node:assert/strict";
import path from "node:path";

import type { TagMeta } from "@marko/component-meta";
import type { MarkupContent } from "vscode-html-languageservice";

import { createMarkoDataProvider } from "../data-provider";
import {
  createVirtualCode,
  fixturePath,
} from "../source-completions/__tests__/helpers";

describe("marko-template data provider", () => {
  it("provides custom Marko tags as HTML data", () => {
    const fileName = fixturePath("script", "class-api-basic", "index.marko");
    const { virtualCode } = createVirtualCode(fileName, "<div█/>");
    const provider = createMarkoDataProvider(virtualCode);

    const tag = provider
      .provideTags()
      .find((entry) => entry.name === "fancy-button");
    assert(tag, "Missing fancy-button tag data");
    assert.match(
      String(
        isMarkupContent(tag.description)
          ? tag.description.value
          : tag.description,
      ),
      /components\/fancy-button\/index\.marko/,
    );
  });

  it("exposes optional attrs with enum values", () => {
    const fileName = fixturePath("script", "basic", "index.marko");
    const { virtualCode } = createVirtualCode(fileName, "<div█/>");
    const provider = createMarkoDataProvider(virtualCode);

    const attr = provider
      .provideAttributes("div")
      .find((entry) => entry.name === "class");
    assert(attr, "Missing class attr data");
  });

  it("keeps canonical names for standard attrs used by HTML hover", () => {
    const fileName = fixturePath("script", "basic", "index.marko");
    const { virtualCode } = createVirtualCode(fileName, '<div class="test"█/>');
    const provider = createMarkoDataProvider(virtualCode);

    const attr = provider
      .provideAttributes("div")
      .find((entry) => entry.name === "class");
    assert(attr, "Missing canonical class attr data");
  });

  it("enriches custom tag and input docs with prepared component metadata", async () => {
    const fileName = fixturePath("script", "tags-api-basic", "index.marko");
    const { virtualCode } = createVirtualCode(fileName, "<fancy-button mes█/>");
    const componentMeta = createPreparedComponentMeta({
      file: path.join(
        path.dirname(fileName),
        "components/fancy-button/index.marko",
      ),
      name: "fancy-button",
      description: "",
      declarations: [],
      input: {
        name: "Input",
        description: "",
        type: "Input",
        source: "export interface Input {\n  message: string;\n}",
        declarations: [],
        tags: [],
        schema: "Input",
        getDeclarations() {
          return [];
        },
        getTypeObject() {
          return undefined;
        },
        props: [
          {
            name: "message",
            description: "",
            type: "string",
            required: true,
            declarations: [],
            tags: [],
            schema: "string",
            global: false,
            getDeclarations() {
              return [];
            },
            getTypeObject() {
              return undefined as never;
            },
          },
        ],
        events: [],
        attrTags: [],
      },
      inputs: [
        {
          name: "message",
          description: "",
          type: "string",
          required: true,
          declarations: [],
          tags: [],
          schema: "string",
          global: false,
          getDeclarations() {
            return [];
          },
          getTypeObject() {
            return undefined as never;
          },
        },
      ],
      events: [],
      attrTags: [],
    });
    await componentMeta.preloadTags();
    const provider = createMarkoDataProvider(
      virtualCode,
      undefined,
      undefined,
      componentMeta,
    );

    const tag = provider
      .provideTags()
      .find((entry) => entry.name === "fancy-button");
    assert(tag, "Missing fancy-button tag data");
    assert.match(
      String(
        isMarkupContent(tag.description)
          ? tag.description.value
          : tag.description,
      ),
      /Input Props:[\s\S]*`message: string`/,
    );
    assert.match(
      String(
        isMarkupContent(tag.description)
          ? tag.description.value
          : tag.description,
      ),
      /Input:[\s\S]*```typescript[\s\S]*export interface Input \{[\s\S]*message: string;/,
    );

    const attr = provider
      .provideAttributes("fancy-button")
      .find((entry) => entry.name === "message");
    assert(attr, "Missing message attr data");
    assert.match(
      String(
        isMarkupContent(attr.description)
          ? attr.description.value
          : attr.description,
      ),
      /`message: string`/,
    );
  });
});

function isMarkupContent(value: unknown): value is MarkupContent {
  return !!value && typeof value === "object" && "value" in value;
}

function createPreparedComponentMeta(meta: TagMeta) {
  return {
    async preloadTags() {},
    getTagMetaForTag(tagName: string) {
      return tagName === meta.name ? meta : undefined;
    },
    getInputMetaForTag(tagName: string, attrName: string) {
      return tagName === meta.name
        ? meta.input?.props.find((input) => input.name === attrName)
        : undefined;
    },
    getEventMetaForTag(tagName: string, eventName: string) {
      return tagName === meta.name
        ? meta.input?.events.find((event) => event.name === eventName)
        : undefined;
    },
    getAttrTagMetaForTag(tagName: string, attrTagName: string) {
      return tagName === meta.name
        ? meta.input?.attrTags.find((attrTag) => attrTag.name === attrTagName)
        : undefined;
    },
    getAttrTagInputMetaForTag(
      tagName: string,
      attrTagName: string,
      attrName: string,
    ) {
      return tagName === meta.name
        ? meta.input?.attrTags
            .find((attrTag) => attrTag.name === attrTagName)
            ?.props.find((input) => input.name === attrName)
        : undefined;
    },
  };
}
