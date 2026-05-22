import assert from "node:assert/strict";

import path from "path";
import {
  type Hover,
  type Location,
  type LocationLink,
  Position,
  Range,
} from "vscode-languageserver-protocol/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import {
  getLanguageServer,
  shutdownLanguageServer,
} from "./util/language-service";

const FIXTURE_DIR = path.join(__dirname, "fixtures");

after(shutdownLanguageServer);

describe("behavior matrix", () => {
  it("hovers attribute values as JavaScript expressions", async () => {
    const hover = await requestHover(
      fixturePath("script", "basic", "index.marko"),
      ["static const testId = 'button-id';", "<button id=test█Id />"].join(
        "\n",
      ),
    );

    assert(hover, "Expected hover result");
    assert.match(getHoverText(hover), /const testId: "button-id"/);
  });

  it("defines custom tags", async () => {
    const locations = await requestDefinition(
      fixturePath("script", "class-api-basic", "index.marko"),
      "<fancy-button█ />",
    );

    assert(locations?.length, "Expected definition result");
    assert.match(
      getDefinitionUri(locations[0]!),
      /components\/fancy-button\/index\.marko$/,
    );
  });

  it("provides document links from native HTML attributes", async () => {
    const links = await requestDocumentLinks(
      fixturePath("script", "basic", "index.marko"),
      '<a href="./linked.txt">Link</a>',
    );

    assert(links.length, "Expected document links");
    assert(
      links.some((link) => link.target?.endsWith("/linked.txt")),
      "Expected href document link",
    );
  });

  it("provides semantic tokens for embedded script expressions", async () => {
    const tokens = await requestSemanticTokens(
      fixturePath("script", "basic", "index.marko"),
      ["static const tokenValue = 'id';", "<button id=tokenValue />"].join(
        "\n",
      ),
    );

    assert(tokens?.data.length, "Expected semantic token data");
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
    const definitions = await serverHandle.sendDefinitionRequest(uri, position);
    return definitions
      ? Array.isArray(definitions)
        ? definitions
        : [definitions]
      : undefined;
  } finally {
    await serverHandle.closeTextDocument(uri);
  }
}

async function requestDocumentLinks(fileName: string, source: string) {
  const serverHandle = await getLanguageServer();
  const uri = URI.file(fileName).toString();

  await serverHandle.openInMemoryDocument(uri, "marko", source);

  try {
    return (await serverHandle.sendDocumentLinkRequest(uri)) ?? [];
  } finally {
    await serverHandle.closeTextDocument(uri);
  }
}

async function requestSemanticTokens(fileName: string, source: string) {
  const serverHandle = await getLanguageServer();
  const uri = URI.file(fileName).toString();

  await serverHandle.openInMemoryDocument(uri, "marko", source);

  try {
    return await serverHandle.sendSemanticTokensRangeRequest(
      uri,
      Range.create(Position.create(0, 0), Position.create(10, 0)),
    );
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

function getHoverText(hover: Hover) {
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

function getDefinitionUri(location: Location | LocationLink) {
  return "targetUri" in location ? location.targetUri : location.uri;
}
