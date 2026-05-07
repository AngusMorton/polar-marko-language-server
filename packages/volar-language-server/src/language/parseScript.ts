import type { TaglibLookup } from "@marko/compiler/babel-utils";
import {
  extractScript,
  parse,
  Project,
  ScriptLang,
} from "@marko/language-tools";
import type { CodeMapping, VirtualCode } from "@volar/language-core";

export function parseScripts(
  parsed: ReturnType<typeof parse>,
  ts: typeof import("typescript"),
  tagLookup: TaglibLookup,
  translator: ReturnType<typeof Project.getConfig>["translator"],
  scriptLang: ScriptLang,
): VirtualCode[] {
  const script = extractScript({
    parsed,
    scriptLang,
    lookup: tagLookup,
    ts: ts,
    translator,
  });
  const scriptText = script.toString();

  // Marko often emits the same source token multiple times in generated TS
  // (for example, once for the public value and again for change plumbing).
  // Volar will query every generated mapping whose feature flag allows it, so
  // remember the first generated occurrence as the editor-facing one.
  const firstGeneratedBySource = new Map<string, number>();
  for (const token of script.tokens) {
    const key = `${token.sourceStart}:${token.length}`;
    if (!firstGeneratedBySource.has(key)) {
      firstGeneratedBySource.set(key, token.generatedStart);
    }
  }

  // Keep verification on every generated token so TypeScript still checks all
  // generated code, but expose hover/navigation/completion from only the primary
  // mapping. This matches Volar's intended split between type-checking and
  // editor features and prevents duplicate or internal hovers from generated
  // implementation details.
  const mappings: CodeMapping[] = script.tokens.flatMap((token) => {
    const sourceEnd = token.sourceStart + token.length;
    const key = `${token.sourceStart}:${token.length}`;
    const sourceText = parsed.code.slice(token.sourceStart, sourceEnd);
    const isPrimary = firstGeneratedBySource.get(key) === token.generatedStart;

    // Container tokens can cover later, more precise source tokens. If both are
    // semantic, Volar may prefer the wrapper expression over the real source
    // symbol, so overlapping containers stay verification-only.
    const hasInternalOverlap = script.tokens.some((other) => {
      return (
        other !== token &&
        other.sourceStart > token.sourceStart &&
        other.sourceStart < sourceEnd
      );
    });
    const shouldTrimSemanticBoundary =
      (!/\w/.test(sourceText) || sourceText.includes("\n")) &&
      script.tokens.some((other) => {
        return other !== token && other.sourceStart === sourceEnd;
      });

    // This full-length mapping is always available for diagnostics. Editor
    // features are opt-in below only when the generated token is the best user
    // visible representation of the source token.
    const mapping: CodeMapping = {
      sourceOffsets: [token.sourceStart],
      generatedOffsets: [token.generatedStart],
      lengths: [token.length],
      data: {
        completion: false,
        format: false,
        navigation: false,
        semantic: false,
        structure: false,
        verification: true,
      },
    };

    if (!isPrimary || hasInternalOverlap) {
      return [mapping];
    }

    const semanticLength = shouldTrimSemanticBoundary
      ? token.length - 1
      : token.length;

    // Boundary mappings that end exactly where a real token starts can make
    // hovers on the real token resolve to adjacent whitespace/wrapper code. Trim
    // only the editor-feature mapping; diagnostics keep the full range above.
    const semanticMapping: CodeMapping = {
      sourceOffsets: [token.sourceStart],
      generatedOffsets: [token.generatedStart],
      lengths: [semanticLength],
      data: {
        completion: true,
        format: false,
        navigation: true,
        semantic: true,
        structure: true,
        verification: false,
      },
    };

    if (semanticLength <= 0) {
      return [mapping];
    }

    return shouldTrimSemanticBoundary
      ? [mapping, semanticMapping]
      : [
          {
            ...semanticMapping,
            data: { ...semanticMapping.data, verification: true },
          },
        ];
  });

  if (mappings.length > 0) {
    return [
      {
        id: "script",
        languageId: scriptLang === ScriptLang.ts ? "ts" : "js",
        snapshot: {
          getText: (start, end) => scriptText.substring(start, end),
          getLength: () => scriptText.length,
          getChangeRange: () => undefined,
        },
        mappings: mappings,
        embeddedCodes: [],
      },
    ];
  }

  return [];
}
