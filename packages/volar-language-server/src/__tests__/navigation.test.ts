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

  it("adds custom tag input declarations to definitions", async () => {
    const locations = await requestDefinition(
      fixturePath("script", "tags-api-basic", "index.marko"),
      "<fancy-button█ />",
    );

    assert(locations?.length, "Expected definition result");
    assert.match(
      getDefinitionUri(locations[0]!),
      /components\/fancy-button\/index\.marko$/,
    );
    assert(
      locations.some(
        (location) =>
          /components\/fancy-button\/index\.marko$/.test(
            getDefinitionUri(location),
          ) && getDefinitionStartLine(location) === 0,
      ),
      "Expected definition result for the component Input declaration",
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

  it("adds custom event input declarations to definitions", async () => {
    const locations = await requestDefinition(
      fixturePath("script", "tags-api-basic", "index.marko"),
      "<fancy-button onSelect█() {} />",
    );

    assert(locations?.length, "Expected event definition result");
    assert(
      locations.some(
        (location) =>
          /components\/fancy-button\/index\.marko$/.test(
            getDefinitionUri(location),
          ) && getDefinitionStartLine(location) === 8,
      ),
      "Expected definition result for the component event declaration",
    );
  });

  it("hovers custom tag docs from component meta", async () => {
    const hover = await requestHover(
      fixturePath("script", "tags-api-basic", "index.marko"),
      "<fancy-button█ />",
    );

    assert(hover, "Expected hover result");
    assert.match(getHoverText(hover), /Input Props:[\s\S]*`message: string`/);
    assert.match(
      getHoverText(hover),
      /Input:[\s\S]*```typescript[\s\S]*export interface Input extends Omit<Marko\.Input<"div">, "content" \| "onSelect" \| "title"> \{[\s\S]*message: string;[\s\S]*tone\?: Tone;/,
    );
    assert.doesNotMatch(getHoverText(hover), /Custom Marko tag discovered/);
    assert.equal(countMatches(getHoverText(hover), /Input Props:/g), 1);
  });

  it("hovers imported identifier tags from component meta", async () => {
    const hover = await requestHover(
      fixturePath("script", "tags-api-basic", "index.marko"),
      [
        'import FancyButton from "./components/fancy-button/index.marko";',
        "<FancyButton█ />",
      ].join("\n"),
    );

    assert(hover, "Expected hover result");
    assert.match(getHoverText(hover), /Input Props:[\s\S]*`message: string`/);
    assert.doesNotMatch(getHoverText(hover), /Built in|HTMLElement|HTML tag/i);
  });

  it("hovers custom tag attrs from component meta", async () => {
    const hover = await requestHover(
      fixturePath("script", "tags-api-basic", "index.marko"),
      '<fancy-button message█="hello" />',
    );

    assert(hover, "Expected hover result");
    assert.match(getHoverText(hover), /`message: string`/);
  });

  it("prefers component metadata for custom tag attrs over HTML attrs", async () => {
    const hover = await requestHover(
      fixturePath("script", "tags-api-basic", "index.marko"),
      '<fancy-button title█="hello" />',
    );

    const text = getHoverText(hover!);
    assert(hover, "Expected hover result");
    assert.match(text, /title: string/);
    assert.match(text, /Component-specific title docs\./);
    assert.doesNotMatch(text, /advisory information related to the element/i);
  });

  it("hovers custom attr tags from component meta", async () => {
    const hover = await requestHover(
      fixturePath("script", "tags-api-basic", "index.marko"),
      "<fancy-button><@icon█ name='search'/></fancy-button>",
    );

    assert(hover, "Expected attr tag hover result");
    assert.match(getHoverText(hover), /`@icon/);
    assert.match(getHoverText(hover), /with `name: string`/);
  });

  it("hovers shorthand attribute values as JavaScript expressions", async () => {
    const hover = await requestHover(
      fixturePath("script", "basic", "index.marko"),
      ["static const testId = 'button-id';", "<button id=test█Id />"].join(
        "\n",
      ),
    );

    assert(hover, "Expected hover result");
    assert.match(getHoverText(hover), /const testId: "button-id"/);
    assert.deepEqual(hover.range, {
      start: Position.create(1, 11),
      end: Position.create(1, 17),
    });
  });

  it("hovers object attribute value members as JavaScript expressions", async () => {
    const hover = await requestHover(
      fixturePath("script", "tags-api-basic", "index.marko"),
      [
        "static const temp = true;",
        "<fancy-button custom={ te█mp: true, options: false } />",
      ].join("\n"),
    );

    assert(hover, "Expected hover result");
    assert.match(getHoverText(hover), /\(property\) temp: boolean/);
    assert.deepEqual(hover.range, {
      start: Position.create(1, 23),
      end: Position.create(1, 27),
    });
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

function getDefinitionStartLine(location: {
  range?: { start: { line: number } };
  targetSelectionRange?: { start: { line: number } };
}) {
  return (
    location.targetSelectionRange?.start.line ?? location.range?.start.line
  );
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}
