import { Project } from "@marko/language-tools";
import fs from "fs";
import snapshot from "mocha-snap";
import path from "path";
import {
  type CompletionItem,
  CompletionItemKind,
  Position,
} from "vscode-languageserver";
// import { bench, run } from "mitata";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { codeFrame } from "./util/code-frame";
import {
  getLanguageServer,
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

      try {
        for (const filename of loadMarkoFiles(fixtureDir)) {
          if (unsavedDocuments.has(URI.file(filename).toString())) {
            continue;
          }

          const doc = await serverHandle.openTextDocument(filename, "marko");
          const code = doc.getText();

          let results = "";

          for (const position of getHovers(doc)) {
            const hoverInfo = await serverHandle.sendHoverRequest(
              doc.uri,
              position,
            );

            const loc = { start: position, end: position };

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

          const scriptOutput:
            | {
                language: string;
                content: string;
              }
            | undefined = await serverHandle.sendExecuteCommandRequest(
            "marko.debug.showScriptOutput",
          );
          if (scriptOutput) {
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
          if (htmlOutput) {
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

          await serverHandle.closeTextDocument(doc.uri);

          await snapshot(results, {
            file: path.relative(
              fixtureDir,
              filename.replace(/\.marko$/, ".md"),
            ),
            dir: fixtureDir,
          });
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

function* getHovers(doc: TextDocument): Generator<Position> {
  for (const { index } of doc.getText().matchAll(/\^\?/g)) {
    const pos = doc.positionAt(index!);
    yield {
      line: pos.line - 1,
      character: pos.character,
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
