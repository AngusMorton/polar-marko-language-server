import { Project } from "@marko/language-tools";
import fs from "fs";
import snapshot from "mocha-snap";
import path from "path";
import {
  type CompletionItem,
  CompletionItemKind,
  type DocumentLink,
  type Location,
  type LocationLink,
  Position,
  Range,
  type SemanticTokens,
} from "vscode-languageserver";
// import { bench, run } from "mitata";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { codeFrame } from "./util/code-frame";
import {
  getLanguageServer,
  SEMANTIC_TOKEN_MODIFIERS,
  SEMANTIC_TOKEN_TYPES,
  shutdownLanguageServer,
} from "./util/language-service";

Project.setDefaultTypePaths({
  internalTypesFile:
    require.resolve("@marko/language-tools/marko.internal.d.ts"),
  markoTypesFile: require.resolve("marko/index.d.ts"),
});

// const SHOULD_BENCH = process.env.BENCH;
// const BENCHED = new Set<string>();
const FIXTURE_DIR = path.join(__dirname, "fixtures");

after(shutdownLanguageServer);

for (const subdir of fs.readdirSync(FIXTURE_DIR)) {
  const fixtureSubdir = path.join(FIXTURE_DIR, subdir);

  if (!fs.statSync(fixtureSubdir).isDirectory()) continue;
  for (const entry of fs.readdirSync(fixtureSubdir)) {
    it(entry, async () => {
      const serverHandle = await getLanguageServer();

      const fixtureDir = path.join(fixtureSubdir, entry);
      const unsavedDocuments = await openUnsavedDocuments(
        serverHandle,
        fixtureDir,
      );
      const shouldSnapshotGeneratedOutput =
        subdir !== "document-links" && subdir !== "semantic-tokens";

      try {
        for (const filename of loadMarkoFiles(fixtureDir)) {
          if (unsavedDocuments.has(URI.file(filename).toString())) {
            continue;
          }

          const doc = await serverHandle.openTextDocument(filename, "marko");
          const code = doc.getText();

          let results = "";

          for (const { position, useHoverRange } of getHovers(doc)) {
            const hoverInfo = await serverHandle.sendHoverRequest(
              doc.uri,
              position,
            );

            const loc =
              useHoverRange && hoverInfo?.range
                ? hoverInfo.range
                : { start: position, end: position };

            let message = "";
            const contents = hoverInfo?.contents;
            if (contents) {
              if (Array.isArray(contents)) {
                message = "\n" + contents.join("\n  ");
              } else if (typeof contents === "object") {
                message = contents.value;
              } else {
                message = contents;
              }
            }

            if (message) {
              results += `### Ln ${position.line + 1}, Col ${
                position.character + 1
              }\n\`\`\`marko\n${codeFrame(
                code,
                message.replace(/```typescript\r?\n([\s\S]*)\r?\n```/gm, "$1"),
                loc,
              )}\n\`\`\`\n\n`;
            }
          }

          if (results.length) {
            results = `## Hovers\n${results}`;
          }

          let completionResults = "";
          for (const position of getCompletions(doc)) {
            const completions = await serverHandle.sendCompletionRequest(
              doc.uri,
              position,
            );
            const loc = { start: position, end: position };

            completionResults += `### Ln ${position.line + 1}, Col ${
              position.character + 1
            }\n\`\`\`marko\n${codeFrame(code, "cursor", loc)}\n\`\`\`\n\n`;
            completionResults += renderCompletions(
              completions?.items ?? [],
              code,
              doc.offsetAt(position),
            );
          }

          if (completionResults.length) {
            results += `## Completions\n${completionResults}`;
          }

          let definitionResults = "";
          for (const position of getDefinitions(doc)) {
            const definitions = toDefinitionList(
              await serverHandle.sendDefinitionRequest(doc.uri, position),
            );
            const loc = { start: position, end: position };

            definitionResults += `### Ln ${position.line + 1}, Col ${
              position.character + 1
            }\n\`\`\`marko\n${codeFrame(code, "definition", loc)}\n\`\`\`\n\n`;
            definitionResults += renderDefinitions(definitions, fixtureDir);
          }

          if (definitionResults.length) {
            results += `## Definitions\n${definitionResults}`;
          }

          const scriptOutput:
            | {
                language: string;
                content: string;
              }
            | undefined = await serverHandle.sendExecuteCommandRequest(
            "marko.debug.showScriptOutput",
          );
          if (scriptOutput && shouldSnapshotGeneratedOutput) {
            await snapshot(scriptOutput.content, {
              file: path.relative(
                fixtureDir,
                filename.replace(
                  /\.marko$/,
                  scriptOutput.language === "typescript" ? ".ts" : ".js",
                ),
              ),
              dir: fixtureDir,
            });
          }

          const htmlOutput:
            | {
                language: string;
                content: string;
              }
            | undefined = await serverHandle.sendExecuteCommandRequest(
            "marko.debug.showHtmlOutput",
          );
          if (htmlOutput && shouldSnapshotGeneratedOutput) {
            await snapshot(htmlOutput.content, {
              file: path.relative(
                fixtureDir,
                filename.replace(/\.marko$/, ".html"),
              ),
              dir: fixtureDir,
            });
          }

          const diagnosticReport =
            await serverHandle.sendDocumentDiagnosticRequest(doc.uri);
          if (
            diagnosticReport.kind === "full" &&
            diagnosticReport.items &&
            diagnosticReport.items.length
          ) {
            results += "## Diagnostics\n";

            diagnosticReport.items.sort((a, b) => {
              const sourceDiff =
                getDiagnosticSourcePriority(a.source) -
                getDiagnosticSourcePriority(b.source);
              if (sourceDiff !== 0) return sourceDiff;

              const lineDiff = a.range.start.line - b.range.start.line;
              if (lineDiff === 0) {
                return a.range.start.character - b.range.start.character;
              }
              return lineDiff;
            });
            for (const error of diagnosticReport.items) {
              const loc = {
                start: error.range.start,
                end: error.range.end,
              };
              results += `### Ln ${loc.start.line + 1}, Col ${
                loc.start.character + 1
              }\n\`\`\`marko\n${codeFrame(code, normalizeMessage(error.message), loc)}\n\`\`\`\n\n`;
            }
          }

          if (subdir === "document-links") {
            const links = await serverHandle.sendDocumentLinkRequest(doc.uri);
            results += `## Document Links\n${renderDocumentLinks(links ?? [], code, fixtureDir)}\n`;
          }

          if (subdir === "semantic-tokens") {
            const tokens = await serverHandle.sendSemanticTokensRangeRequest(
              doc.uri,
              Range.create(Position.create(0, 0), doc.positionAt(code.length)),
            );
            results += `## Semantic Tokens\n${renderSemanticTokens(tokens, doc)}\n`;
          }

          await serverHandle.closeTextDocument(doc.uri);

          if (results.length) {
            await snapshot(results, {
              file: path.relative(
                fixtureDir,
                filename.replace(/\.marko$/, ".md"),
              ),
              dir: fixtureDir,
            });
          }
        }
      } finally {
        for (const uri of unsavedDocuments) {
          await serverHandle.closeTextDocument(uri);
        }
      }
    });
  }
}

function getDiagnosticSourcePriority(source: string | undefined) {
  if (source === "marko") return 0;
  if (source === "ts") return 1;
  if (source?.startsWith("axe-core")) return 2;
  return 3;
}

function normalizeMessage(message: string) {
  return message.split(process.cwd()).join("<workspace>");
}

// if (SHOULD_BENCH) {
//   after(async function () {
//     this.timeout(0);
//     console.log();
//     await run();
//   });
// }

function* getHovers(
  doc: TextDocument,
): Generator<{ position: Position; useHoverRange: boolean }> {
  for (const { 0: marker, index } of doc.getText().matchAll(/\^(\?|~)/g)) {
    const pos = doc.positionAt(index!);
    yield {
      position: {
        line: pos.line - 1,
        character: pos.character,
      },
      useHoverRange: marker === "^~",
    };
  }
}

function* getCompletions(doc: TextDocument): Generator<Position> {
  for (const { index } of doc.getText().matchAll(/\^\|/g)) {
    const pos = doc.positionAt(index!);
    yield {
      line: pos.line - 1,
      character: pos.character,
    };
  }
}

function* getDefinitions(doc: TextDocument): Generator<Position> {
  for (const { index } of doc.getText().matchAll(/\^!/g)) {
    const pos = doc.positionAt(index!);
    yield {
      line: pos.line - 1,
      character: pos.character,
    };
  }
}

function renderCompletions(
  items: CompletionItem[],
  code: string,
  offset: number,
) {
  const prefix = getCompletionPrefix(code, offset);
  if (prefix) {
    const filtered = items.filter((item) =>
      normalizeCompletionLabel(item.label).startsWith(prefix),
    );
    if (filtered.length) {
      items = filtered;
    }
  }

  if (!items.length) {
    return "No completions.\n\n";
  }

  let results = "";
  for (const [index, item] of items.slice(0, 4).entries()) {
    results += `${index + 1}. \`${item.label}\``;
    const kind = item.kind && CompletionItemKind[item.kind];
    if (kind) {
      results += ` (${kind})`;
    }
    results += "\n";

    const newText = getCompletionNewText(item);
    if (newText && newText !== item.label) {
      results += `   newText: \`${formatInline(newText)}\`\n`;
    }

    if (item.detail) {
      results += `   detail: ${formatInline(item.detail)}\n`;
    }

    const documentation = getCompletionDocumentation(item);
    if (documentation) {
      results += `   documentation: ${formatInline(documentation)}\n`;
    }
  }

  return `${results}\n`;
}

function getCompletionNewText(item: CompletionItem) {
  if (item.textEdit && "newText" in item.textEdit) {
    return item.textEdit.newText;
  }

  return item.insertText;
}

function getCompletionDocumentation(item: CompletionItem) {
  const documentation = item.documentation;
  if (!documentation) return;
  const value =
    typeof documentation === "string" ? documentation : documentation.value;

  const result = value
    .replace(/```typescript\r?\n([\s\S]*?)\r?\n```/g, "$1")
    .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return result.length > 240 ? `${result.slice(0, 237)}...` : result;
}

function getCompletionPrefix(code: string, offset: number) {
  const prefix = code.slice(0, offset).match(/[</@\w$-]*$/)?.[0] ?? "";
  return normalizeCompletionLabel(prefix);
}

function normalizeCompletionLabel(label: CompletionItem["label"]) {
  const value = typeof label === "string" ? label : label.label;
  return value.replace(/^<\/?/, "").replace(/[?>]$/g, "").toLowerCase();
}

function formatInline(value: string) {
  return normalizeMessage(value)
    .replace(/\s+/g, " ")
    .replace(/`/g, "\\`")
    .trim();
}

function toDefinitionList(
  definitions: Location | Location[] | LocationLink[] | null | undefined,
) {
  if (!definitions) return [];
  return Array.isArray(definitions) ? definitions : [definitions];
}

function renderDefinitions(
  definitions: Array<Location | LocationLink>,
  fixtureDir: string,
) {
  if (!definitions.length) {
    return "No definitions.\n\n";
  }

  let results = "";
  definitions = dedupeDefinitions(definitions);

  for (const [index, definition] of definitions.entries()) {
    const uri = getDefinitionUri(definition);
    const range = getDefinitionRange(definition);
    results += `${index + 1}. ${formatUri(uri, fixtureDir)}:${
      range.start.line + 1
    }:${range.start.character + 1}\n`;
    results += renderTargetFrame(uri, range);
  }

  return `${results}\n`;
}

function dedupeDefinitions(definitions: Array<Location | LocationLink>) {
  const seen = new Set<string>();
  return definitions.filter((definition) => {
    const uri = getDefinitionUri(definition);
    const range = getDefinitionRange(definition);
    const key = `${uri}:${range.start.line}:${range.start.character}:${range.end.line}:${range.end.character}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDefinitionUri(definition: Location | LocationLink) {
  return "targetUri" in definition ? definition.targetUri : definition.uri;
}

function getDefinitionRange(definition: Location | LocationLink) {
  return "targetSelectionRange" in definition
    ? definition.targetSelectionRange
    : definition.range;
}

function renderTargetFrame(uri: string, range: Range) {
  const fsPath = URI.parse(uri).fsPath;
  if (!fsPath || !fs.existsSync(fsPath)) {
    return "";
  }

  const language = fsPath.endsWith(".marko") ? "marko" : "typescript";
  return `\`\`\`${language}\n${codeFrame(
    fs.readFileSync(fsPath, "utf8"),
    "definition",
    range,
  )}\n\`\`\`\n`;
}

function renderDocumentLinks(
  links: DocumentLink[],
  code: string,
  fixtureDir: string,
) {
  if (!links.length) {
    return "No document links.\n";
  }

  let results = "";
  for (const [index, link] of links.entries()) {
    results += `${index + 1}. ${link.target ? formatUri(link.target, fixtureDir) : "<missing>"}\n`;
    results += `\`\`\`marko\n${codeFrame(code, "link", link.range)}\n\`\`\`\n`;
  }

  return results;
}

function renderSemanticTokens(
  tokens: SemanticTokens | null | undefined,
  doc: TextDocument,
) {
  if (!tokens?.data.length) {
    return "No semantic tokens.\n";
  }

  let line = 0;
  let character = 0;
  let results = "";

  for (let i = 0; i < tokens.data.length; i += 5) {
    const deltaLine = tokens.data[i]!;
    const deltaStart = tokens.data[i + 1]!;
    const length = tokens.data[i + 2]!;
    const tokenType = SEMANTIC_TOKEN_TYPES[tokens.data[i + 3]!] ?? "unknown";
    const tokenModifiers = getSemanticTokenModifiers(tokens.data[i + 4]!);

    line += deltaLine;
    character = deltaLine === 0 ? character + deltaStart : deltaStart;

    const start = Position.create(line, character);
    const end = Position.create(line, character + length);
    const text = doc.getText(Range.create(start, end));
    results += `${i / 5 + 1}. \`${text}\` (${tokenType}${
      tokenModifiers ? `, ${tokenModifiers}` : ""
    }) at Ln ${line + 1}, Col ${character + 1}\n`;
  }

  return results;
}

function getSemanticTokenModifiers(mask: number) {
  const modifiers: string[] = [];
  for (let i = 0; i < SEMANTIC_TOKEN_MODIFIERS.length; i++) {
    if (mask & (1 << i)) {
      modifiers.push(SEMANTIC_TOKEN_MODIFIERS[i]!);
    }
  }

  return modifiers.join(", ");
}

function formatUri(uri: string, fixtureDir: string) {
  const fsPath = URI.parse(uri).fsPath;
  if (fsPath?.startsWith(fixtureDir)) {
    return path.relative(fixtureDir, fsPath);
  }

  return normalizeMessage(uri);
}

async function openUnsavedDocuments(
  serverHandle: Awaited<ReturnType<typeof getLanguageServer>>,
  fixtureDir: string,
) {
  const unsavedDocuments = new Set<string>();
  const unsavedDir = path.join(fixtureDir, "__unsaved__");

  if (!fs.existsSync(unsavedDir)) {
    return unsavedDocuments;
  }

  for (const filename of loadMarkoFiles(unsavedDir)) {
    const target = path.join(fixtureDir, path.relative(unsavedDir, filename));
    const uri = URI.file(target).toString();
    await serverHandle.openInMemoryDocument(
      uri,
      "marko",
      fs.readFileSync(filename, "utf8"),
    );
    unsavedDocuments.add(uri);
  }

  return unsavedDocuments;
}

export function* loadMarkoFiles(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir)) {
    const file = path.join(dir, entry);
    const stat = fs.statSync(file);
    if (stat.isFile()) {
      if (file.endsWith(".marko")) {
        yield file;
      }
    } else if (
      stat.isDirectory() &&
      entry !== "__snapshots__" &&
      entry !== "__unsaved__"
    ) {
      yield* loadMarkoFiles(file);
    }
  }
}
