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
  it("adds component metadata when HTML hover only has tag discovery docs", () => {
    const fileName = fixturePath("script", "tags-api-basic", "index.marko");
    const source = "<fancy-button█ />";
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
        getTagMetaForTag(tagName) {
          return tagName === "fancy-button"
            ? {
                input: {
                  name: "Input",
                  description: "",
                  type: "Input",
                  source: "export interface Input {\n  message: string;\n}",
                  props: [
                    {
                      name: "message",
                      type: "string",
                      required: true,
                      description: "",
                    },
                  ],
                  events: [],
                  attrTags: [],
                },
              }
            : undefined;
        },
      } as never,
    );

    const text = getHoverText(hover);
    assert.match(text, /Custom Marko tag discovered/);
    assert.match(text, /Input Props:[\s\S]*`message: string`/);
    assert.equal(countMatches(text, /Input Props:/g), 1);
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

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}
