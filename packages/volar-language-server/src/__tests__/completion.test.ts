import assert from "node:assert/strict";

import path from "path";
import {
  CompletionItemKind,
  type CompletionList,
  type MarkupContent,
  Position,
} from "vscode-languageserver-protocol/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import {
  getLanguageServer,
  shutdownLanguageServer,
} from "./util/language-service";

const FIXTURE_DIR = path.join(__dirname, "fixtures");

after(shutdownLanguageServer);

describe("completion", () => {
  it("provides built-in HTML tag completions", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "basic", "index.marko"),
      "<sp█/>",
    );
    const item = getCompletion(completions, "span");

    assert.equal(item.kind, CompletionItemKind.Property);
    assert.equal(getNewText(item), "span");
    assert.match(getDocumentation(item), /MDN Reference/);
  });

  it("provides local tag completions ahead of TypeScript", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "class-api-basic", "index.marko"),
      "<fan█/>",
    );
    const item = getCompletion(completions, "fancy-button");

    assert.equal(getNewText(item), "fancy-button");
    assert.match(
      getDocumentation(item),
      /components\/fancy-button\/index\.marko/,
    );
  });

  it("provides identifier tag completions from the embedded script scope", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "prefer-local-identifier-tag-name", "index.marko"),
      [
        'import CustomTagA from "<TestTagA>";',
        'import CustomTagB from "<TestTagB>";',
        "",
        "<const/TestTagA = CustomTagA/>",
        "<Test█/>",
      ].join("\n"),
    );
    const item = getCompletion(completions, "TestTagA");

    assert.equal(item.textEdit?.newText, "TestTagA");
    assert.equal(getNewText(item), "TestTagA");
  });

  it("provides closing tag completions", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "basic", "index.marko"),
      "<div>█",
    );
    const item = getCompletion(completions, "</div>");

    assert.equal(item.kind, CompletionItemKind.Class);
    assert.equal(item.insertText, "\n\t$0\n</div>");
  });

  it("provides attribute name completions with snippets", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "basic", "index.marko"),
      "<div cla█/>",
    );
    const item = getCompletion(completions, "class?");

    assert.equal(item.label, "class?");
    assert.equal(getNewText(item), "class");
  });

  it("provides attribute modifier completions", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "basic", "index.marko"),
      "<div id:s█/>",
    );

    assert.deepEqual(
      completions.items.map((item) => item.label),
      ["scoped", "no-update"],
    );
  });

  it("provides custom tag input docs from component meta", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "tags-api-basic", "index.marko"),
      "<fancy-button mess█/>",
    );
    const item = getCompletion(completions, "message");

    assert.match(getDocumentation(item), /`message: string`/);
  });
});

async function requestCompletions(
  fileName: string,
  sourceWithCursor: string,
): Promise<CompletionList> {
  const serverHandle = await getLanguageServer();
  const { content, position, uri } = getDocumentState(
    fileName,
    sourceWithCursor,
  );

  await serverHandle.openInMemoryDocument(uri, "marko", content);

  try {
    const completions = await serverHandle.sendCompletionRequest(uri, position);
    assert(completions, `Expected completions for ${fileName}`);
    return completions;
  } finally {
    await serverHandle.closeTextDocument(uri);
  }
}

function getDocumentState(fileName: string, sourceWithCursor: string) {
  const cursorIndex = sourceWithCursor.indexOf("█");
  assert.notEqual(cursorIndex, -1, "Missing completion cursor marker");

  const content = sourceWithCursor.replace("█", "");
  const uri = URI.file(fileName).toString();
  const document = TextDocument.create(uri, "marko", 0, content);

  return {
    content,
    uri,
    position: Position.create(
      document.positionAt(cursorIndex).line,
      document.positionAt(cursorIndex).character,
    ),
  };
}

function fixturePath(...segments: string[]) {
  return path.join(FIXTURE_DIR, ...segments);
}

function getCompletion(completions: CompletionList, label: string) {
  const item = completions.items.find((entry) => entry.label === label);
  assert(item, `Missing completion item ${label}`);
  return item;
}

function getDocumentation(item: { documentation?: string | MarkupContent }) {
  const documentation = item.documentation;
  if (!documentation) return "";
  return typeof documentation === "string"
    ? documentation
    : documentation.value;
}

function getNewText(item: { textEdit?: { newText: string } | null }) {
  return item.textEdit?.newText;
}
