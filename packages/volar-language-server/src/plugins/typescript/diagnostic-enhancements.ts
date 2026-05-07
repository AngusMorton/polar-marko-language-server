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

    // If the diagnostic is wholly contained within a mapping, then leave it untouched
    // because it is already correctly positioned.
    const containedMapping = mappings.find((mapping) => {
      return getMappingSegments(mapping).some(
        ([generatedStartOffset, length]) => {
          const generatedEndOffset = generatedStartOffset + length;
          return (
            scriptStartOffset >= generatedStartOffset &&
            scriptEndOffset <= generatedEndOffset
          );
        },
      );
    });

    if (containedMapping) {
      return diagnostic;
    }

    // Otherwise, find the best mapping to adjust the diagnostic position
    // by calculating the overlap with the generated offsets. The mapping
    // with the largest overlap will be used to adjust the diagnostic position.

    // This logic is used to ensure that diagnostics are positioned correctly
    // over tag names and attributes.
    let bestSegment: [generatedOffset: number, length: number] | undefined;
    let maxOverlap = 0;

    for (const mapping of mappings) {
      for (const [generatedStartOffset, length] of getMappingSegments(
        mapping,
      )) {
        const generatedEndOffset = generatedStartOffset + length;

        // Calculate overlap between diagnostic and mapping
        const overlapStart = Math.max(generatedStartOffset, scriptStartOffset);
        const overlapEnd = Math.min(generatedEndOffset, scriptEndOffset);
        const overlap = Math.max(0, overlapEnd - overlapStart);

        if (overlap > maxOverlap) {
          maxOverlap = overlap;
          bestSegment = [generatedStartOffset, length];
        }
      }
    }

    if (bestSegment) {
      const [generatedStartOffset, length] = bestSegment;
      const start = document.positionAt(generatedStartOffset);
      const end = document.positionAt(generatedStartOffset + length);
      diagnostic.range.start = start;
      diagnostic.range.end = end;
      return diagnostic;
    }

    return diagnostic;
  });
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
