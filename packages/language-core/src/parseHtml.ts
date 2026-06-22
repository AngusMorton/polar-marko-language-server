import { type Extracted, extractHTML, NodeType } from "@marko/language-tools";
import type { CodeMapping, VirtualCode } from "@volar/language-core";

export function parseHtml(
  parsed: ReturnType<typeof extractHTML>,
): VirtualCode[] {
  const scriptText = parsed.extracted.toString();
  const mappings: CodeMapping[] = generateMappingsFromExtracted(
    parsed.extracted,
  );

  if (mappings.length > 0) {
    return [
      {
        id: "html",
        languageId: "html",
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

function generateMappingsFromExtracted(extracted: Extracted): CodeMapping[] {
  return extracted.tokens.map((it) => {
    const sourceNode = extracted.parsed.nodeAt(
      it.sourceStart + Math.min(1, Math.max(0, it.sourceLength - 1)),
    );
    const isAttrValue = sourceNode?.type === NodeType.AttrValue;

    return {
      sourceOffsets: [it.sourceStart],
      generatedOffsets: [it.generatedStart],
      lengths: [it.sourceLength],
      generatedLengths: [it.generatedLength],
      data: {
        completion: !isAttrValue,
        format: false,
        navigation: !isAttrValue,
        semantic: !isAttrValue,
        structure: !isAttrValue,
        verification: true,
      },
    };
  });
}
