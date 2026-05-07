import type { CodeMapping } from "@volar/language-core";
import type { Diagnostic } from "@volar/language-server";
import { TextDocument } from "vscode-languageserver-textdocument";

export function enhanceDiagnosticPositions(
  diagnostics: Diagnostic[],
  document: TextDocument,
  mappings: CodeMapping[],
) {
  return diagnostics.map((diagnostic) => {
    const scriptStartOffset = document.offsetAt(diagnostic.range.start);
    const scriptEndOffset = document.offsetAt(diagnostic.range.end);

    if (isContainedInMapping(scriptStartOffset, scriptEndOffset, mappings)) {
      return diagnostic;
    }

    const mappedRange = getOverlappingGeneratedRange(
      scriptStartOffset,
      scriptEndOffset,
      mappings,
    );
    if (!mappedRange) return diagnostic;

    return {
      ...diagnostic,
      range: {
        start: document.positionAt(mappedRange.start),
        end: document.positionAt(mappedRange.end),
      },
    };
  });
}

function isContainedInMapping(
  startOffset: number,
  endOffset: number,
  mappings: CodeMapping[],
) {
  return mappings.some((mapping) => {
    return getMappingSegments(mapping).some(
      ([generatedStartOffset, length]) => {
        const generatedEndOffset = generatedStartOffset + length;
        return (
          startOffset >= generatedStartOffset && endOffset <= generatedEndOffset
        );
      },
    );
  });
}

function getOverlappingGeneratedRange(
  startOffset: number,
  endOffset: number,
  mappings: CodeMapping[],
) {
  let start: number | undefined;
  let end: number | undefined;

  for (const mapping of mappings) {
    for (const [generatedStartOffset, length] of getMappingSegments(mapping)) {
      const generatedEndOffset = generatedStartOffset + length;
      const overlapStart = Math.max(generatedStartOffset, startOffset);
      const overlapEnd = Math.min(generatedEndOffset, endOffset);

      if (overlapStart >= overlapEnd) continue;

      start =
        start === undefined ? overlapStart : Math.min(start, overlapStart);
      end = end === undefined ? overlapEnd : Math.max(end, overlapEnd);
    }
  }

  if (start !== undefined && end !== undefined) {
    return { start, end };
  }
}

function getMappingSegments(
  mapping: CodeMapping,
): [generatedOffset: number, length: number][] {
  return mapping.generatedOffsets.map((generatedOffset, index) => {
    const generatedLength = mapping.generatedLengths?.[index];
    const length =
      generatedLength ?? mapping.lengths[index] ?? mapping.lengths[0];
    return [generatedOffset, length];
  });
}
