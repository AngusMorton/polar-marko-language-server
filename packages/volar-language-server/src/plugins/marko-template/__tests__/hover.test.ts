import assert from "node:assert/strict";

import { MarkupKind } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { provideHover } from "../hover";
import {
  createVirtualCode,
  fixturePath,
} from "../source-completions/__tests__/helpers";

describe("marko-template hover", () => {
  it("preserves HTML hover text and clamps the hover range", () => {
    const fileName = fixturePath("script", "tags-api-basic", "index.marko");
    const source = "<█fancy-button />";
    const offset = source.indexOf("█");
    const content = source.replace("█", "");
    const { virtualCode } = createVirtualCode(fileName, source);
    const uri = URI.file(fileName).toString();
    const document = TextDocument.create(uri, "marko", 0, content);
    const hover = provideHover(
      {
        document,
        sourceUri: URI.file(fileName),
        root: virtualCode,
        offset,
        position: document.positionAt(offset),
        node: virtualCode.markoAst.nodeAt(offset),
      },
      {
        contents: {
          kind: MarkupKind.Markdown,
          value:
            "Custom Marko tag discovered from:\n\n[../components/fancy-button/index.marko](file:///components/fancy-button/index.marko)",
        },
      },
      {
        async preloadTags() {},
        getTagMetaForTag() {},
      } as never,
    );

    const text = getHoverText(hover);
    assert.match(text, /Custom Marko tag discovered/);
    assert.deepEqual(hover?.range, {
      start: document.positionAt(content.indexOf("fancy-button")),
      end: document.positionAt(
        content.indexOf("fancy-button") + "fancy-button".length,
      ),
    });
  });

  it("adds modifier docs for source hovers", () => {
    const fileName = fixturePath("script", "hover-routing", "index.marko");
    const source = `<FancyButton class:sco█ped="primary" />`;
    const offset = source.indexOf("█");
    const content = source.replace("█", "");
    const { virtualCode } = createVirtualCode(fileName, source);
    const uri = URI.file(fileName).toString();
    const document = TextDocument.create(uri, "marko", 0, content);
    const hover = provideHover(
      {
        document,
        sourceUri: URI.file(fileName),
        root: virtualCode,
        offset,
        position: document.positionAt(offset),
        node: virtualCode.markoAst.nodeAt(offset),
      },
      undefined,
    );

    assert.match(getHoverText(hover), /Use to prefix with a unique ID/);
  });
});

function getHoverText(hover: ReturnType<typeof provideHover>) {
  const contents = hover?.contents;
  if (!contents) return "";
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents
      .map((entry) => (typeof entry === "string" ? entry : entry.value))
      .join("\n");
  }
  return contents.value;
}
