import assert from "node:assert/strict";

import { CompletionItemKind } from "vscode-languageserver";

import {
  normalizeAttrCompletionKind,
  normalizeAttrValueCompletionKind,
} from "../util";

describe("normalizeAttrCompletionKind", () => {
  function kindOf(label: string, initialKind?: CompletionItemKind) {
    const item = { label, kind: initialKind };
    normalizeAttrCompletionKind(item);
    return item.kind;
  }

  it("marks event handlers with the Event kind", () => {
    for (const label of [
      "onClick",
      "onclick",
      "on-click",
      'on<event>("<method>")?',
      'once<event>("<method>")?',
      "onabort?",
    ]) {
      assert.equal(
        kindOf(label, CompletionItemKind.Property),
        CompletionItemKind.Event,
        `expected ${label} to be an Event`,
      );
    }
  });

  it("marks ordinary props/attributes with the Field kind", () => {
    for (const label of ["message", "class", "title?", "value"]) {
      assert.equal(
        kindOf(label, CompletionItemKind.Property),
        CompletionItemKind.Field,
        `expected ${label} to be a Field`,
      );
    }
  });

  it("leaves Marko directive/modifier keywords untouched", () => {
    assert.equal(
      kindOf("scoped", CompletionItemKind.Keyword),
      CompletionItemKind.Keyword,
    );
    assert.equal(
      kindOf("no-update", CompletionItemKind.Keyword),
      CompletionItemKind.Keyword,
    );
  });

  it("does not treat non-event names that merely start with other letters as events", () => {
    assert.equal(
      kindOf("disabled", CompletionItemKind.Property),
      CompletionItemKind.Field,
    );
  });
});

describe("normalizeAttrValueCompletionKind", () => {
  it("marks attribute value choices as enum members", () => {
    const item = { label: "submit", kind: CompletionItemKind.Unit };
    normalizeAttrValueCompletionKind(item);
    assert.equal(item.kind, CompletionItemKind.EnumMember);
  });
});
