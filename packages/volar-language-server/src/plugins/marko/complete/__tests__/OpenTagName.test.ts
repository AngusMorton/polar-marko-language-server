import assert from "node:assert/strict";

import { CompletionItemKind } from "vscode-languageserver-protocol/node";

import { OpenTagName } from "../OpenTagName";
import { createVirtualCode, fixturePath, getNewText } from "./helpers";

describe("OpenTagName", () => {
  it("provides nested attr tag completions", () => {
    const fileName = fixturePath(
      "script",
      "attr-tag-target-property",
      "index.marko",
    );
    const { virtualCode, offset } = createVirtualCode(
      fileName,
      "<test-tag>\n  <@█/>\n</test-tag>",
    );
    const node = virtualCode.markoAst.nodeAt(offset)!;
    const completions = OpenTagName(node as never, virtualCode);
    assert(completions);

    const item = completions.find((entry) => entry.label === "@item");
    assert(item, "Missing completion item @item");
    assert.equal(item.kind, CompletionItemKind.Class);
    assert.equal(getNewText(item), "@item");
  });
});
