import assert from "node:assert/strict";

import { AttrName } from "../AttrName";
import { createVirtualCode, fixturePath, getNewText } from "./helpers";

describe("AttrName", () => {
  it("provides Marko attr completion edits", () => {
    const fileName = fixturePath("script", "basic", "index.marko");
    const { virtualCode, offset } = createVirtualCode(fileName, "<div cla█/>");
    const node = virtualCode.markoAst.nodeAt(offset)!;
    const completions = AttrName(node as never, virtualCode, offset);
    assert(completions);

    const item = completions.find((entry) => entry.label === "class?");
    assert(item, "Missing completion item class?");
    assert.equal(item.insertTextFormat, 2);
    assert.equal(getNewText(item), "class=");
  });
});
