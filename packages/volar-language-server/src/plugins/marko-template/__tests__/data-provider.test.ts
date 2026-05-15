import assert from "node:assert/strict";

import ts from "typescript";

import {
  createVirtualCode,
  fixturePath,
} from "../../marko/complete/__tests__/helpers";
import { createComponentMetaManager } from "../component-meta";
import { createMarkoDataProvider } from "../data-provider";

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
        tag.description && "value" in tag.description
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

  it("enriches custom tag and input docs with component metadata", () => {
    const fileName = fixturePath("script", "tags-api-basic", "index.marko");
    const { virtualCode } = createVirtualCode(fileName, "<fancy-button mes█/>");
    const provider = createMarkoDataProvider(
      virtualCode,
      createComponentMetaManager(ts),
    );

    const tag = provider
      .provideTags()
      .find((entry) => entry.name === "fancy-button");
    assert(tag, "Missing fancy-button tag data");
    assert.match(
      String(
        tag.description && "value" in tag.description
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
        attr.description && "value" in attr.description
          ? attr.description.value
          : attr.description,
      ),
      /`message: string`/,
    );
  });
});
