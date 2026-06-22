import type { TaglibLookup } from "@marko/compiler/babel-utils";
import {
  extractScript,
  Mapping,
  NodeType,
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
  runtimeTypesCode?: string,
): VirtualCode[] {
  const script = extractScript({
    parsed,
    scriptLang,
    lookup: tagLookup,
    ts: ts,
    translator,
    runtimeTypesCode,
  });
  const scriptText = script.toString();

  // Only `full` tokens are the primary, editor-facing source<->generated
  // mapping (this mirrors the extractor's own `#sourceToGeneratedView`, which
  // also considers `full` tokens only). `alias` tokens are secondary source
  // links and `anchor` tokens are zero-width diagnostic markers; neither should
  // drive the editor-feature heuristics below (which dedupe and compare real
  // generated occurrences), so both stay verification-only.
  const fullTokens = script.tokens.filter(
    (token) => token.mapping === Mapping.full,
  );

  // Marko often emits the same source token multiple times in generated TS
  // (for example, once for the public value and again for change plumbing).
  // Volar will query every generated mapping whose feature flag allows it, so
  // remember the first generated occurrence as the editor-facing one.
  const firstGeneratedBySource = new Map<string, number>();
  // Number of tokens that begin at a given source offset. Used to detect when a
  // token ends exactly where another token begins without an O(n) rescan.
  const tokenStartCounts = new Map<number, number>();
  for (const token of fullTokens) {
    const key = `${token.sourceStart}:${token.sourceLength}`;
    if (!firstGeneratedBySource.has(key)) {
      firstGeneratedBySource.set(key, token.generatedStart);
    }
    tokenStartCounts.set(
      token.sourceStart,
      (tokenStartCounts.get(token.sourceStart) ?? 0) + 1,
    );
  }

  // Sorted, de-duplicated list of token source starts. `hasInternalOverlap`
  // below needs to know whether any other token begins strictly inside the
  // current token's source range; a binary search over this list answers that
  // in O(log n) instead of scanning every token (which made the whole pass
  // O(n^2) on large files).
  const sortedTokenStarts = [...tokenStartCounts.keys()].sort((a, b) => a - b);
  const hasTokenStartInRange = (afterOffset: number, beforeOffset: number) => {
    // Find the first token start strictly greater than `afterOffset`.
    let min = 0;
    let max = sortedTokenStarts.length;
    while (min < max) {
      const mid = (min + max) >>> 1;
      if (sortedTokenStarts[mid]! <= afterOffset) {
        min = mid + 1;
      } else {
        max = mid;
      }
    }
    return (
      min < sortedTokenStarts.length && sortedTokenStarts[min]! < beforeOffset
    );
  };

  // Keep verification on every generated token so TypeScript still checks all
  // generated code, but expose hover/navigation/completion from only the primary
  // mapping. This matches Volar's intended split between type-checking and
  // editor features and prevents duplicate or internal hovers from generated
  // implementation details.
  const mappings: CodeMapping[] = script.tokens.flatMap((token) => {
    // This full-length mapping is always available for diagnostics. Editor
    // features are opt-in below only when the generated token is the best user
    // visible representation of the source token. `generatedLengths` keeps the
    // generated side accurate for anchors, whose generated width is zero.
    const mapping: CodeMapping = {
      sourceOffsets: [token.sourceStart],
      generatedOffsets: [token.generatedStart],
      lengths: [token.sourceLength],
      generatedLengths: [token.generatedLength],
      data: {
        completion: false,
        format: false,
        navigation: false,
        semantic: false,
        structure: false,
        verification: true,
      },
    };

    // Only `full` tokens are editor-facing; `alias`/`anchor` tokens carry
    // diagnostics only.
    if (token.mapping !== Mapping.full) {
      return [mapping];
    }

    const sourceEnd = token.sourceStart + token.sourceLength;
    const key = `${token.sourceStart}:${token.sourceLength}`;
    const sourceText = parsed.code.slice(token.sourceStart, sourceEnd);
    const sourceNode = getNodeAtTokenStart(parsed, token.sourceStart);
    const sourceInnerNode = getNodeAtTokenStart(
      parsed,
      token.sourceStart + Math.min(1, Math.max(0, token.sourceLength - 1)),
    );
    const sourceFeatureNode =
      sourceInnerNode?.type === NodeType.OpenTagName ||
      sourceInnerNode?.type === NodeType.AttrName
        ? sourceInnerNode
        : sourceNode;
    const isAttrModifierExpression =
      sourceFeatureNode?.type === NodeType.AttrName &&
      isModifierExpressionToken(parsed, sourceFeatureNode, token.sourceStart);
    const isPrimary = firstGeneratedBySource.get(key) === token.generatedStart;
    const shouldUseSourceAttrCompletions =
      sourceFeatureNode?.type === NodeType.AttrName &&
      sourceFeatureNode.parent.parent.type === NodeType.Tag &&
      isCustomTag(sourceFeatureNode.parent.parent.nameText || "", tagLookup);

    // Container tokens can cover later, more precise source tokens. If both are
    // semantic, Volar may prefer the wrapper expression over the real source
    // symbol, so overlapping containers stay verification-only.
    const hasInternalOverlap = hasTokenStartInRange(
      token.sourceStart,
      sourceEnd,
    );
    const shouldTrimSemanticBoundary =
      (!/\w/.test(sourceText) || sourceText.includes("\n")) &&
      (tokenStartCounts.get(sourceEnd) ?? 0) -
        (token.sourceStart === sourceEnd ? 1 : 0) >
        0;
    const shouldTrimNameBoundary =
      !isAttrModifierExpression &&
      (sourceFeatureNode?.type === NodeType.OpenTagName ||
        sourceFeatureNode?.type === NodeType.AttrName);
    const shouldUseTypeScriptHover =
      isAttrModifierExpression ||
      (sourceFeatureNode?.type !== NodeType.OpenTagName &&
        sourceFeatureNode?.type !== NodeType.AttrName);
    const shouldUsePreciseAttrValueNavigation =
      sourceFeatureNode?.type === NodeType.AttrValue;

    if (!isPrimary || hasInternalOverlap) {
      return [mapping];
    }

    // Volar treats source-map ends as valid hover targets, so trim editor-facing name
    // mappings to keep whitespace after tag/attr names from resolving to TS.
    const semanticLength = shouldTrimNameBoundary
      ? token.sourceLength - 1
      : shouldTrimSemanticBoundary
        ? token.sourceLength - 1
        : token.sourceLength;

    // Boundary mappings that end exactly where a real token starts can make
    // hovers on the real token resolve to adjacent whitespace/wrapper code. Trim
    // only the editor-feature mapping; diagnostics keep the full range above.
    const semanticMapping: CodeMapping = {
      sourceOffsets: [token.sourceStart],
      generatedOffsets: [token.generatedStart],
      lengths: [Math.max(0, semanticLength)],
      data: {
        completion: !shouldUseSourceAttrCompletions && !shouldTrimNameBoundary,
        format: false,
        navigation: !shouldUsePreciseAttrValueNavigation,
        semantic: shouldUseTypeScriptHover,
        structure: true,
        verification: false,
      },
    };

    const navigationMappings = shouldUsePreciseAttrValueNavigation
      ? getIdentifierNavigationMappings(sourceText, token, scriptText)
      : undefined;

    const completionMapping: CodeMapping | undefined =
      shouldTrimNameBoundary && !shouldUseSourceAttrCompletions
        ? {
            sourceOffsets: [token.sourceStart],
            generatedOffsets: [token.generatedStart],
            lengths: [token.sourceLength],
            data: {
              completion: true,
              format: false,
              navigation: false,
              semantic: false,
              structure: false,
              verification: false,
            },
          }
        : undefined;

    if (semanticLength <= 0) {
      return [
        mapping,
        ...(completionMapping ? [completionMapping] : []),
        ...(navigationMappings ?? []),
      ];
    }

    if (shouldTrimSemanticBoundary || shouldTrimNameBoundary) {
      return [
        mapping,
        semanticMapping,
        ...(completionMapping ? [completionMapping] : []),
        ...(navigationMappings ?? []),
      ];
    }

    return [
      {
        ...semanticMapping,
        data: { ...semanticMapping.data, verification: true },
      },
      ...(navigationMappings ?? []),
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

function getIdentifierNavigationMappings(
  sourceText: string,
  token: { sourceStart: number; generatedStart: number },
  scriptText: string,
): CodeMapping[] {
  const mappings: CodeMapping[] = [];
  const identifierReg = /[$A-Z_a-z][$0-9A-Z_a-z]*/g;
  let match: RegExpExecArray | null;

  while ((match = identifierReg.exec(sourceText))) {
    const [{ length }] = match;
    if (isObjectLiteralKey(sourceText, match.index + length)) {
      continue;
    }

    const generatedStart = token.generatedStart + match.index;
    if (
      scriptText.slice(generatedStart, generatedStart + length) !== match[0]
    ) {
      continue;
    }

    mappings.push({
      sourceOffsets: [token.sourceStart + match.index],
      generatedOffsets: [generatedStart],
      lengths: [length],
      data: {
        completion: false,
        format: false,
        navigation: true,
        semantic: false,
        structure: false,
        verification: false,
      },
    });
  }

  return mappings;
}

function isObjectLiteralKey(sourceText: string, end: number) {
  let offset = end;
  while (/\s/.test(sourceText[offset] || "")) {
    offset++;
  }
  if (sourceText[offset] !== ":") {
    return false;
  }

  offset = end;
  while (offset > 0 && /\s/.test(sourceText[offset - 1] || "")) {
    offset--;
  }
  while (offset > 0 && isIdentifierPart(sourceText.charCodeAt(offset - 1))) {
    offset--;
  }
  while (offset > 0 && /\s/.test(sourceText[offset - 1] || "")) {
    offset--;
  }

  const previous = sourceText[offset - 1];
  return previous === "{" || previous === ",";
}

function isIdentifierPart(charCode: number) {
  return (
    (charCode >= 65 && charCode <= 90) ||
    (charCode >= 97 && charCode <= 122) ||
    (charCode >= 48 && charCode <= 57) ||
    charCode === 36 ||
    charCode === 95
  );
}

function getNodeAtTokenStart(parsed: ReturnType<typeof parse>, offset: number) {
  const node = parsed.nodeAt(offset);
  if (
    node?.type === NodeType.Tag ||
    node?.type === NodeType.AttrTag ||
    node?.type === NodeType.AttrNamed
  ) {
    const next = parsed.nodeAt(offset + 1);
    return isChildNode(next, node) ? next : node;
  }

  return node;
}

function isChildNode(
  node: ReturnType<ReturnType<typeof parse>["nodeAt"]>,
  parent: ReturnType<ReturnType<typeof parse>["nodeAt"]>,
) {
  let current = node?.parent;
  while (current) {
    if (current === parent) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isModifierExpressionToken(
  parsed: ReturnType<typeof parse>,
  node: NonNullable<ReturnType<ReturnType<typeof parse>["nodeAt"]>>,
  offset: number,
) {
  const modifierIndex = parsed.read(node).indexOf(":");
  return modifierIndex !== -1 && offset > node.start + modifierIndex;
}

function isCustomTag(tagName: string, tagLookup: TaglibLookup) {
  const tag = tagName && tagLookup.getTag(tagName);
  return !!tag && !tag.html;
}
