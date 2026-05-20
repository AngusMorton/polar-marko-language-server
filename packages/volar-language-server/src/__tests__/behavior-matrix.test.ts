import assert from "node:assert/strict";

import path from "path";
import {
  type CompletionItem,
  type CompletionList,
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
  it("delegates native HTML attribute value completions", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "basic", "index.marko"),
      '<button type="su█" />',
    );
    const item = getCompletion(completions, "submit");

    assert.equal(getNewText(item), "submit");
  });

  it("does not delegate bound attribute value completions to HTML", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "basic", "index.marko"),
      ["static const submitValue = 'submit';", "<button type=su█ />"].join(
        "\n",
      ),
    );

    assert(
      !completions.items.some((item) => item.label === "submit"),
      "Expected bound expression completion to avoid HTML value suggestions",
    );
  });

  it("does not delegate placeholders to HTML completions", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "basic", "index.marko"),
      "<div>${su█}</div>",
    );

    assert(
      !completions.items.some((item) => item.label === "summary"),
      "Expected placeholder expression completion to avoid HTML tag suggestions",
    );
  });

  it("keeps custom tag completions available", async () => {
    const completions = await requestCompletions(
      fixturePath("script", "class-api-basic", "index.marko"),
      "<fan█/>",
    );
    const item = getCompletion(completions, "fancy-button");

    assert.equal(getNewText(item), "fancy-button");
  });

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

  it("uses unsaved component metadata edits for completions", async () => {
    const serverHandle = await getLanguageServer();
    const componentFile = fixturePath(
      "script",
      "tags-api-basic",
      "components",
      "fancy-button",
      "index.marko",
    );
    const usageFile = fixturePath("script", "tags-api-basic", "index.marko");
    const componentUri = URI.file(componentFile).toString();
    const usageState = getDocumentState(usageFile, "<fancy-button dyn█ />");

    await serverHandle.openInMemoryDocument(
      componentUri,
      "marko",
      [
        'static type Tone = "info" | "warning";',
        "",
        'export interface Input extends Marko.Input<"div"> {',
        "  message: string;",
        "  dynamic: boolean;",
        "  tone?: Tone;",
        "}",
        "",
        "<div>Hello ${input.message}</div>",
      ].join("\n"),
    );
    await serverHandle.openInMemoryDocument(
      usageState.uri,
      "marko",
      usageState.content,
    );

    try {
      const completions = await serverHandle.sendCompletionRequest(
        usageState.uri,
        usageState.position,
      );
      assert(completions, "Expected completions");
      assert(getCompletion(completions, "dynamic"));
    } finally {
      await serverHandle.closeTextDocument(usageState.uri);
      await serverHandle.closeTextDocument(componentUri);
    }
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

function getCompletion(completions: CompletionList, label: string) {
  const item = completions.items.find((entry) => entry.label === label);
  assert(item, `Missing completion item ${label}`);
  return item;
}

function getNewText(item: CompletionItem) {
  return item.textEdit && "newText" in item.textEdit
    ? item.textEdit.newText
    : item.insertText;
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
