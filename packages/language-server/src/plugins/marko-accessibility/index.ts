import { getLines, getLocation, type Location } from "@marko/language-tools";
import type { Diagnostic, LanguageServicePlugin } from "@volar/language-server";
import axe from "axe-core";
import { JSDOM } from "jsdom";
import type { SourceMapGenerator } from "source-map-js";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { MarkoVirtualCode } from "../../language";
import { ruleExceptions } from "./axe-rules/rule-exceptions";

// Helper function to convert generated offsets back to source locations using source map
function sourceLocationAt(
  sourceMapGenerator: SourceMapGenerator,
  originalSourceText: string,
  generatedStart: number,
  generatedEnd: number,
): Location | undefined {
  try {
    // Convert SourceMapGenerator to JSON for consumption
    const sourceMap = sourceMapGenerator.toJSON();
    const { SourceMapConsumer } = require("source-map-js");
    const consumer = new SourceMapConsumer(sourceMap);

    // Find the original position for the generated start
    const startPos = consumer.originalPositionFor({
      line: 1, // For now, assume single line - this could be improved
      column: generatedStart,
    });

    const endPos = consumer.originalPositionFor({
      line: 1,
      column: generatedEnd,
    });

    if (
      startPos.line !== null &&
      startPos.column !== null &&
      endPos.line !== null &&
      endPos.column !== null
    ) {
      // Convert back to offsets and create location
      const startOffset = convertLineColumnToOffset(
        startPos.line - 1,
        startPos.column,
        originalSourceText,
      );
      const endOffset = convertLineColumnToOffset(
        endPos.line - 1,
        endPos.column,
        originalSourceText,
      );

      // Get lines for getLocation call
      const sourceLines = getLines(originalSourceText);
      return getLocation(sourceLines, startOffset, endOffset);
    }
  } catch (error) {
    console.warn("Failed to map generated offset to source location:", error);
  }
  return undefined;
}

// Helper function to convert line/column to offset
function convertLineColumnToOffset(
  line: number,
  column: number,
  text: string,
): number {
  const lines = text.split("\n");
  let offset = 0;

  for (let i = 0; i < line && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline character
  }

  return offset + column;
}

// This plugin provides accessibility diagnostics for Marko templates.
export const create = (): LanguageServicePlugin => {
  return {
    name: "marko-accessibility",
    capabilities: {
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create(context) {
      return {
        async provideDiagnostics(document, token) {
          if (token.isCancellationRequested) return;

          return await worker(document, async (virtualCode) => {
            const htmlAst = virtualCode.htmlAst;
            if (!htmlAst) {
              return [];
            }

            const htmlText = htmlAst.code;
            const jsdom = new JSDOM(htmlText, {
              includeNodeLocations: true,
            });
            const { documentElement } = jsdom.window.document;

            const getViolationNodes = async (runOnly: string[]) =>
              (
                await axe.run(documentElement, {
                  runOnly,
                  rules: {
                    "color-contrast": { enabled: false },
                  },
                  resultTypes: ["violations"],
                  elementRef: true,
                })
              ).violations.flatMap(({ nodes, id }) =>
                nodes.map((node) => ({ ...node, ruleId: id })),
              );

            const release = await acquireMutexLock();
            const violations = await getViolationNodes(
              Object.keys(ruleExceptions),
            );
            release();

            return violations.flatMap((result) => {
              const { element } = result;
              if (!element) return [];
              const ruleId = result.ruleId as keyof typeof ruleExceptions;

              if (element.dataset.markoNodeId) {
                const details =
                  htmlAst.nodeDetails[element.dataset.markoNodeId];
                if (
                  (ruleExceptions[ruleId].attrSpread &&
                    details.hasDynamicAttrs) ||
                  (ruleExceptions[ruleId].unknownBody &&
                    details.hasDynamicBody) ||
                  ruleExceptions[ruleId].dynamicAttrs?.some(
                    (attr) => element.getAttribute(attr) === "dynamic",
                  )
                ) {
                  return [];
                }
              }

              const generatedLoc = jsdom.nodeLocation(element);
              if (!generatedLoc) return [];

              // Get the original source text from the source map's source content
              const sourceMapJson = htmlAst.map.toJSON();
              const originalSourceText =
                sourceMapJson.sourcesContent?.[0] || "";

              const sourceRange = sourceLocationAt(
                htmlAst.map,
                originalSourceText,
                generatedLoc.startOffset + 1,
                generatedLoc.startOffset + 1 + element.tagName.length,
              );
              if (!sourceRange) return [];

              return [
                {
                  range: sourceRange,
                  severity: 3,
                  source: `axe-core(${ruleId})`,
                  message:
                    result.failureSummary ?? "unknown accessibility issue",
                } satisfies Diagnostic,
              ];
            });
          });
        },
      };

      async function worker<T>(
        document: TextDocument,
        callback: (markoDocument: MarkoVirtualCode) => T,
      ): Promise<Awaited<T> | undefined> {
        const decoded = context.decodeEmbeddedDocumentUri(
          URI.parse(document.uri),
        );
        const sourceScript =
          decoded && context.language.scripts.get(decoded[0]);
        const virtualCode =
          decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
        if (!(virtualCode instanceof MarkoVirtualCode)) return;

        return await callback(virtualCode);
      }
    },
  };
};

let lock: Promise<void> | undefined;
async function acquireMutexLock() {
  const currLock = lock;
  let resolve!: () => void;
  lock = new Promise((_) => (resolve = _));
  await currLock;
  return resolve;
}
