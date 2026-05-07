import {
  type CodeInformation,
  type Mapper,
  shouldReportDiagnostics,
} from "@volar/language-core";
import type { Diagnostic } from "@volar/language-server";
import type { TextDocument } from "vscode-languageserver-textdocument";

export function enhanceDiagnosticPositions(
  diagnostics: Diagnostic[],
  document: TextDocument,
  map: Mapper,
) {
  return diagnostics.map((diagnostic) => {
    const scriptStartOffset = document.offsetAt(diagnostic.range.start);
    const scriptEndOffset = document.offsetAt(diagnostic.range.end);
    const shouldReport = (data: CodeInformation) =>
      shouldReportDiagnostics(data, diagnostic.source, diagnostic.code);

    if (
      mapsToSourceRange(map, scriptStartOffset, scriptEndOffset, shouldReport)
    ) {
      return diagnostic;
    }

    // TypeScript sometimes reports a span that starts or ends in generated glue.
    // Clip to the reportable generated overlap, then verify Volar can map it.
    const reportableRange = getReportableGeneratedRange(
      scriptStartOffset,
      scriptEndOffset,
      map,
      shouldReport,
    );
    if (!reportableRange) return diagnostic;

    if (
      !mapsToSourceRange(
        map,
        reportableRange.start,
        reportableRange.end,
        shouldReport,
      )
    ) {
      return diagnostic;
    }

    return {
      ...diagnostic,
      range: {
        start: document.positionAt(reportableRange.start),
        end: document.positionAt(reportableRange.end),
      },
    };
  });
}

function mapsToSourceRange(
  map: Mapper,
  generatedStart: number,
  generatedEnd: number,
  shouldReport: (data: CodeInformation) => boolean,
) {
  for (const _range of map.toSourceRange(
    generatedStart,
    generatedEnd,
    true,
    shouldReport,
  )) {
    return true;
  }
  return false;
}

function getReportableGeneratedRange(
  startOffset: number,
  endOffset: number,
  map: Mapper,
  shouldReport: (data: CodeInformation) => boolean,
) {
  let start: number | undefined;
  let end: number | undefined;

  for (const mapping of map.mappings) {
    if (!shouldReport(mapping.data)) continue;

    for (let index = 0; index < mapping.generatedOffsets.length; index++) {
      const generatedStartOffset = mapping.generatedOffsets[index]!;
      const generatedEndOffset =
        generatedStartOffset + getGeneratedLength(mapping, index);
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

function getGeneratedLength(
  mapping: Mapper["mappings"][number],
  index: number,
) {
  return (
    mapping.generatedLengths?.[index] ??
    mapping.lengths[index] ??
    mapping.lengths[0]!
  );
}
