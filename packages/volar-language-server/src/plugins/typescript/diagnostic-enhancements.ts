import {
  type CodeInformation,
  type Mapper,
  shouldReportDiagnostics,
} from "@volar/language-core";
import type {
  CompletionItem,
  Diagnostic,
  Hover,
  MarkupContent,
} from "@volar/language-server";
import type { TextDocument } from "vscode-languageserver-textdocument";

/**
 * The TypeScript code Marko generates for a template references a handful of
 * internal helper types that are meaningless to template authors. Left alone
 * they leak verbatim into diagnostic messages (e.g. `does not exist in type
 * 'Directives & Input'`). Vue keeps its `__VLS_` internals out of user-facing
 * messages; we do the same for Marko's glue so errors read in template terms.
 */
export function cleanMarkoDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return diagnostics.map((diagnostic) => {
    const message = cleanMarkoDiagnosticMessage(diagnostic.message);
    const relatedInformation = diagnostic.relatedInformation?.map((related) => {
      const relatedMessage = cleanMarkoDiagnosticMessage(related.message);
      return relatedMessage === related.message
        ? related
        : { ...related, message: relatedMessage };
    });

    if (
      message === diagnostic.message &&
      relatedInformation === diagnostic.relatedInformation
    ) {
      return diagnostic;
    }

    return { ...diagnostic, message, relatedInformation };
  });
}

export function cleanMarkoDiagnosticMessage(message: string): string {
  return cleanMarkoTypeArtifacts(message);
}

/**
 * Strips Marko's internal generated helper types from any text that displays a
 * TypeScript type (diagnostic messages, hover quick-info, completion details).
 */
export function cleanMarkoTypeArtifacts(text: string): string {
  return (
    text
      // `Marko.Directives` is intersected into every tag's attribute type to
      // allow global directives (`class`, `key`, event handlers, ...). It is
      // never something the author wrote, so drop it from the displayed type.
      .replace(/(?:Marko\.)?Directives & /g, "")
      .replace(/ & (?:Marko\.)?Directives\b/g, "")
      // Attribute-tag types carry a synthetic iterator member so they can be
      // both spread and repeated. It is pure glue inside `AttrTag<{ ... }>`.
      .replace(/(?:readonly )?\[Symbol\.iterator\]: any;\s*/g, "")
      // `AttrMissing` is the sentinel that marks an attribute as optional; it
      // only adds noise to value-type unions shown to the author.
      .replace(/ \| AttrMissing\b/g, "")
      .replace(/\bAttrMissing \| /g, "")
      // `Marko.Void` is a branded stand-in for `void` used by generated body
      // signatures; display it as plain `void`.
      .replace(/\bVoid\b/g, "void")
  );
}

/** Scrubs internal Marko types from a hover's rendered contents in place. */
export function cleanMarkoHover<T extends Hover>(hover: T): T {
  const contents = hover.contents;
  if (typeof contents === "string") {
    return { ...hover, contents: cleanMarkoTypeArtifacts(contents) };
  }

  if (Array.isArray(contents)) {
    return {
      ...hover,
      contents: contents.map((entry) =>
        typeof entry === "string"
          ? cleanMarkoTypeArtifacts(entry)
          : { ...entry, value: cleanMarkoTypeArtifacts(entry.value) },
      ),
    };
  }

  if (contents && typeof contents === "object" && "value" in contents) {
    return {
      ...hover,
      contents: { ...contents, value: cleanMarkoTypeArtifacts(contents.value) },
    };
  }

  return hover;
}

/** Scrubs internal Marko types from a completion item's detail/documentation. */
export function cleanMarkoCompletionItem<T extends CompletionItem>(item: T): T {
  const detail =
    item.detail === undefined
      ? undefined
      : cleanMarkoTypeArtifacts(item.detail);
  const documentation = cleanMarkoMarkup(item.documentation);

  if (detail === item.detail && documentation === item.documentation) {
    return item;
  }

  return { ...item, detail, documentation };
}

function cleanMarkoMarkup(
  documentation: string | MarkupContent | undefined,
): string | MarkupContent | undefined {
  if (documentation === undefined) {
    return undefined;
  }

  if (typeof documentation === "string") {
    return cleanMarkoTypeArtifacts(documentation);
  }

  return {
    ...documentation,
    value: cleanMarkoTypeArtifacts(documentation.value),
  };
}

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
