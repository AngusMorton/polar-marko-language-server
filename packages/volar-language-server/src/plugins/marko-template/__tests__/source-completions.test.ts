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
