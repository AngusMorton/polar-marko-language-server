import assert from "node:assert/strict";

import {
  cleanMarkoCompletionItem,
  cleanMarkoDiagnosticMessage,
  cleanMarkoHover,
} from "../diagnostic-enhancements";

describe("cleanMarkoDiagnosticMessage", () => {
  it("drops the internal `Directives &` attribute wrapper", () => {
    assert.equal(
      cleanMarkoDiagnosticMessage(
        `Object literal may only specify known properties, and '"mess"' does not exist in type 'Directives & Input'.`,
      ),
      `Object literal may only specify known properties, and '"mess"' does not exist in type 'Input'.`,
    );
  });

  it("drops the wrapper for native tag types too", () => {
    assert.equal(
      cleanMarkoDiagnosticMessage(
        `Object literal may only specify known properties, and '"cla"' does not exist in type 'Directives & Div'.`,
      ),
      `Object literal may only specify known properties, and '"cla"' does not exist in type 'Div'.`,
    );
  });

  it("keeps the meaningful part of a chained intersection", () => {
    assert.equal(
      cleanMarkoDiagnosticMessage(
        `Argument of type '{ class: string; }' is not assignable to parameter of type 'Directives & Input & { class: string; }'.`,
      ),
      `Argument of type '{ class: string; }' is not assignable to parameter of type 'Input & { class: string; }'.`,
    );
  });

  it("strips the synthetic iterator member from AttrTag displays", () => {
    assert.equal(
      cleanMarkoDiagnosticMessage(
        `Type 'AttrTag<{ readonly size: "huge"; readonly [Symbol.iterator]: any; }>' is not assignable to type 'AttrTag<{ size?: "small" | "large" | undefined; }>'.`,
      ),
      `Type 'AttrTag<{ readonly size: "huge"; }>' is not assignable to type 'AttrTag<{ size?: "small" | "large" | undefined; }>'.`,
    );
  });

  it("removes the AttrMissing sentinel from value unions", () => {
    assert.equal(
      cleanMarkoDiagnosticMessage(
        `Type '"su"' is not assignable to type '"button" | AttrMissing | "submit" | "reset"'.`,
      ),
      `Type '"su"' is not assignable to type '"button" | "submit" | "reset"'.`,
    );
    assert.equal(
      cleanMarkoDiagnosticMessage(
        `Type '() => void' is not assignable to type 'string | number | true | AttrMissing'.`,
      ),
      `Type '() => void' is not assignable to type 'string | number | true'.`,
    );
    assert.equal(
      cleanMarkoDiagnosticMessage(
        `Type '"x"' is not assignable to type 'AttrMissing | "a" | "b"'.`,
      ),
      `Type '"x"' is not assignable to type '"a" | "b"'.`,
    );
  });

  it("renders the branded `Void` helper as plain `void`", () => {
    assert.equal(
      cleanMarkoDiagnosticMessage(`content: ({ children }: Help) => Void;`),
      `content: ({ children }: Help) => void;`,
    );
    // Only the standalone identifier is rewritten.
    assert.equal(
      cleanMarkoDiagnosticMessage(`type MyVoidValue = Avoid;`),
      `type MyVoidValue = Avoid;`,
    );
  });

  it("leaves unrelated messages untouched", () => {
    const message = `Type 'string' is not assignable to type 'number'.`;
    assert.equal(cleanMarkoDiagnosticMessage(message), message);
  });
});

describe("cleanMarkoHover", () => {
  it("scrubs markdown hover contents", () => {
    const hover = cleanMarkoHover({
      contents: {
        kind: "markdown" as const,
        value: "```typescript\n(property) input: Directives & Input\n```",
      },
    });
    assert.deepEqual(hover.contents, {
      kind: "markdown",
      value: "```typescript\n(property) input: Input\n```",
    });
  });

  it("scrubs string and array hover contents", () => {
    assert.deepEqual(
      cleanMarkoHover({ contents: "type: Directives & Input" }).contents,
      "type: Input",
    );
    assert.deepEqual(
      cleanMarkoHover({
        contents: [{ language: "ts", value: "x: string | true | AttrMissing" }],
      }).contents,
      [{ language: "ts", value: "x: string | true" }],
    );
  });
});

describe("cleanMarkoCompletionItem", () => {
  it("scrubs detail and documentation", () => {
    const item = cleanMarkoCompletionItem({
      label: "message",
      detail: "(property) message: string | AttrMissing",
      documentation: {
        kind: "markdown" as const,
        value: "does not exist in type 'Directives & Input'",
      },
    });
    assert.equal(item.detail, "(property) message: string");
    assert.deepEqual(item.documentation, {
      kind: "markdown",
      value: "does not exist in type 'Input'",
    });
  });

  it("returns the same item when nothing needs scrubbing", () => {
    const original = { label: "foo", detail: "(property) foo: number" };
    assert.equal(cleanMarkoCompletionItem(original), original);
  });
});
