import assert from "node:assert/strict";
import path from "node:path";

import type { TagMeta } from "@marko/component-meta";
import type { MarkupContent } from "vscode-html-languageservice";
import { Position } from "vscode-languageserver-protocol/node";
import { URI } from "vscode-uri";

import {
  getLanguageServer,
  shutdownLanguageServer,
} from "../../../__tests__/util/language-service";
import {
  createVirtualCode,
  fixturePath,
} from "../../marko/complete/__tests__/helpers";
import { createMarkoDataProvider } from "../data-provider";

describe("marko-template data provider", () => {
  after(shutdownLanguageServer);

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
      inputs: [
        {
          name: "message",
          description: "",
          type: "string",
          required: true,
          declarations: [],
        },
      ],
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
      /Attributes:[\s\S]*`message: string`/,
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

  it("uses live TypeScript program metadata after unsaved edits", async () => {
    const server = await getLanguageServer();
    const fileName = fixturePath("script", "tags-api-basic", "index.marko");
    const uri = URI.file(fileName).toString();
    const componentUri = URI.file(
      path.join(path.dirname(fileName), "components/fancy-button/index.marko"),
    ).toString();

    await server.openInMemoryDocument(uri, "marko", "<fancy-button mess/>");
    await server.openTextDocument(URI.parse(componentUri).fsPath, "marko");
    try {
      await server.updateTextDocument(componentUri, [
        {
          range: {
            start: Position.create(2, 0),
            end: Position.create(2, 0),
          },
          newText: "  /** Live-only input. */\n  liveOnly?: string;\n",
        },
      ]);

      const completions = await server.sendCompletionRequest(
        uri,
        Position.create(0, 18),
      );
      const liveOnly = completions?.items.find(
        (item) => item.label === "liveOnly?",
      );

      assert(liveOnly, "Expected live-only input completion from unsaved edit");
    } finally {
      await server.closeTextDocument(uri);
      await server.closeTextDocument(componentUri);
    }
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
        ? meta.inputs.find((input) => input.name === attrName)
        : undefined;
    },
  };
}
