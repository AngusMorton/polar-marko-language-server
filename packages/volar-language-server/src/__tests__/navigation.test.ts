import assert from "node:assert/strict";

import path from "path";
import { Position } from "vscode-languageserver-protocol/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import {
  getLanguageServer,
  shutdownLanguageServer,
} from "./util/language-service";

const FIXTURE_DIR = path.join(__dirname, "fixtures");

after(shutdownLanguageServer);

describe("navigation", () => {
  it("hovers Marko HTML directives on native tags", async () => {
    const hover = await requestHover(
      fixturePath("script", "basic", "index.marko"),
      "<div no-update-body█/>",
    );

    assert(hover, "Expected hover result");
    assert.match(getHoverText(hover), /More Info|no-update-body/i);
  });

  it("hovers attribute modifiers with source-aware fallback", async () => {
    const hover = await requestHover(
      fixturePath("script", "basic", "index.marko"),
      '<div id:no-updat█e="value"/>',
    );

    assert(hover, "Expected hover result");
    assert.match(getHoverText(hover), /skip future updates/i);
  });

  it("defines local custom tags from marko-template", async () => {
    const locations = await requestDefinition(
      fixturePath("script", "class-api-basic", "index.marko"),
      ['import FancyButton from "<fancy-button>";', "<fancy-button█ />"].join(
        "\n",
      ),
    );

    assert(locations?.length, "Expected definition result");
    assert.match(
      getDefinitionUri(locations[0]!),
      /components\/fancy-button\/index\.marko$/,
    );
  });

  it("defines local custom attrs from marko-template", async () => {
    const locations = await requestDefinition(
      fixturePath("script", "bound-attr-modifier-ident", "index.marko"),
      "<child value█=(next) => next />",
    );

    assert(locations?.length, "Expected definition result");
    assert.match(getDefinitionUri(locations[0]!), /tags\/child\.marko$/);
  });

  it("hovers custom tag docs from component meta", async () => {
    const hover = await requestHover(
      fixturePath("script", "tags-api-basic", "index.marko"),
      "<fancy-button█ />",
    );

    assert(hover, "Expected hover result");
    assert.match(getHoverText(hover), /Attributes:[\s\S]*`message: string`/);
  });

  it("hovers custom tag attrs from component meta", async () => {
    const hover = await requestHover(
      fixturePath("script", "tags-api-basic", "index.marko"),
      '<fancy-button message█="hello" />',
    );

    assert(hover, "Expected hover result");
    assert.match(getHoverText(hover), /`message: string`/);
  });
});

async function requestHover(fileName: string, sourceWithCursor: string) {
  const serverHandle = await getLanguageServer();
  const { content, position, uri } = getDocumentState(
    fileName,
    sourceWithCursor,
  );

  await serverHandle.openInMemoryDocument(uri, "marko", content);

  try {
    return await serverHandle.sendHoverRequest(uri, position);
  } finally {
    await serverHandle.closeTextDocument(uri);
  }
}

async function requestDefinition(fileName: string, sourceWithCursor: string) {
  const serverHandle = await getLanguageServer();
  const { content, position, uri } = getDocumentState(
    fileName,
    sourceWithCursor,
  );

  await serverHandle.openInMemoryDocument(uri, "marko", content);

  try {
    return await serverHandle.sendDefinitionRequest(uri, position);
  } finally {
    await serverHandle.closeTextDocument(uri);
  }
}

function getDocumentState(fileName: string, sourceWithCursor: string) {
  const cursorIndex = sourceWithCursor.indexOf("█");
  assert.notEqual(cursorIndex, -1, "Missing cursor marker");

  const content = sourceWithCursor.replace("█", "");
  const uri = URI.file(fileName).toString();
  const document = TextDocument.create(uri, "marko", 0, content);
  const cursorPosition = document.positionAt(cursorIndex);

  return {
    content,
    uri,
    position: Position.create(cursorPosition.line, cursorPosition.character),
  };
}

function fixturePath(...segments: string[]) {
  return path.join(FIXTURE_DIR, ...segments);
}

function getHoverText(hover: {
  contents: string | { value: string } | Array<string | { value: string }>;
}) {
  const { contents } = hover;
  if (typeof contents === "string") {
    return contents;
  }
  if (Array.isArray(contents)) {
    return contents
      .map((entry) => (typeof entry === "string" ? entry : entry.value))
      .join("\n");
  }
  return contents.value;
}

function getDefinitionUri(location: { uri?: string; targetUri?: string }) {
  return location.targetUri ?? location.uri ?? "";
}
