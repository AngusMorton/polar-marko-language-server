import assert from "node:assert/strict";

import { Project } from "@marko/language-tools";
import path from "path";
import ts from "typescript";

import { MarkoVirtualCode } from "../../../../language";

const FIXTURE_DIR = path.join(__dirname, "../../../../__tests__/fixtures");

export function fixturePath(...segments: string[]) {
  return path.join(FIXTURE_DIR, ...segments);
}

export function createVirtualCode(fileName: string, sourceWithCursor: string) {
  const offset = offsetAtCursor(sourceWithCursor);
  const code = sourceWithCursor.replace("█", "");
  Project.clearCaches();

  return {
    offset,
    virtualCode: new MarkoVirtualCode(
      fileName,
      ts.ScriptSnapshot.fromString(code),
      ts,
    ),
  };
}

export function getNewText(item: { textEdit?: { newText: string } | null }) {
  return item.textEdit?.newText;
}

export function getDocumentation(item: {
  documentation?: string | { value: string };
}) {
  const documentation = item.documentation;
  if (!documentation) return "";
  return typeof documentation === "string"
    ? documentation
    : documentation.value;
}

function offsetAtCursor(sourceWithCursor: string) {
  const offset = sourceWithCursor.indexOf("█");
  assert.notEqual(offset, -1, "Missing completion cursor marker");
  return offset;
}
