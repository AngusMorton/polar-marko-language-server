import assert from "node:assert/strict";

import { parse, Project, ScriptLang } from "@marko/language-tools";
import path from "path";
import ts from "typescript";

import { parseScripts } from "../parseScript";

describe("parseScripts", () => {
  it("uses runtime type overloads when generating virtual scripts", () => {
    const filename = path.join(__dirname, "fixture.marko");
    const dirname = path.dirname(filename);
    const parsed = parse("export interface Input {}\n<div/>", filename);
    const runtimeTypesCode = `
      /** @marko-overload-start */
      abstract __test(input: Marko.TemplateInput<Input>): Return;
      /** @marko-overload-end */
    `;
    const [script] = parseScripts(
      parsed,
      ts,
      Project.getTagLookup(dirname),
      Project.getConfig(dirname).translator,
      ScriptLang.ts,
      runtimeTypesCode,
    );

    assert(script);
    assert.match(
      script.snapshot.getText(0, script.snapshot.getLength()),
      /__test\(input: Marko\.TemplateInput<Input>\): void;/,
    );
  });
});
