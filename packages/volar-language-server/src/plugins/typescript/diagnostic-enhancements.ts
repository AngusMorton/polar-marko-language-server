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
    // First try clipping to the reportable generated overlap (real copied
    // tokens, the most precise target). Failing that, fall back to an anchor
    // point inside the span: anchors are zero-width generated markers the
    // extractor leaves in synthesized code so a diagnostic with no copied token
    // of its own can still be pulled back to a source range.
    for (const reportableRange of [
      getReportableGeneratedRange(
        scriptStartOffset,
        scriptEndOffset,
        map,
        shouldReport,
      ),
      getAnchoredGeneratedRange(
        scriptStartOffset,
        scriptEndOffset,
        map,
        shouldReport,
      ),
    ]) {
      if (
        reportableRange &&
        mapsToSourceRange(
          map,
          reportableRange.start,
          reportableRange.end,
          shouldReport,
        )
      ) {
        return {
          ...diagnostic,
          range: {
            start: document.positionAt(reportableRange.start),
            end: document.positionAt(reportableRange.end),
          },
        };
      }
    }

    return diagnostic;
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

// Anchors are zero-width generated markers (generated length 0) that the
// extractor emits in front of synthesized code so diagnostics reported there
// map back to a source range. They never overlap a generated span positively,
// so `getReportableGeneratedRange` skips them. When a diagnostic has no copied
// token of its own, snap it to the earliest anchor point inside its span; a
// zero-width generated query at that point resolves to the anchor's full source
// range.
function getAnchoredGeneratedRange(
  startOffset: number,
  endOffset: number,
  map: Mapper,
  shouldReport: (data: CodeInformation) => boolean,
) {
  let anchor: number | undefined;

  for (const mapping of map.mappings) {
    if (!shouldReport(mapping.data)) continue;

    for (let index = 0; index < mapping.generatedOffsets.length; index++) {
      if (getGeneratedLength(mapping, index) !== 0) continue;

      const offset = mapping.generatedOffsets[index]!;
      if (offset < startOffset || offset > endOffset) continue;

      if (anchor === undefined || offset < anchor) anchor = offset;
    }
  }

  if (anchor !== undefined) {
    return { start: anchor, end: anchor };
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
