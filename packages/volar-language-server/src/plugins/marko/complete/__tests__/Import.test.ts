import assert from "node:assert/strict";

import { CompletionItemKind } from "vscode-languageserver-protocol/node";

import { Import } from "../Import";
import {
  createVirtualCode,
  fixturePath,
  getDocumentation,
  getNewText,
} from "./helpers";

describe("Import", () => {
  it("provides tag import completions", () => {
    const fileName = fixturePath(
      "script",
      "import-without-types",
      "index.marko",
    );
    const { virtualCode, offset } = createVirtualCode(
      fileName,
      'import Child from "<Ch█>"',
    );
    const node = virtualCode.markoAst.nodeAt(offset)!;
    const completions = Import(node as never, virtualCode);
    assert(completions);

    const item = completions.find((entry) => entry.label === "<Child>");
    assert(item, "Missing completion item <Child>");
    assert.equal(item.kind, CompletionItemKind.Class);
    assert.equal(getNewText(item), "<Child>");
    assert.match(getDocumentation(item), /components\/Child\/index\.js/);
  });
});
