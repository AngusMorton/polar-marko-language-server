import { extractHTML } from "@marko/language-tools";
import type { CodeMapping, VirtualCode } from "@volar/language-core";
import {
  type MappingItem,
  SourceMapConsumer,
  type SourceMapGenerator,
} from "source-map-js";

export function parseHtml(
  parsed: ReturnType<typeof extractHTML>,
): VirtualCode[] {
  const scriptText = parsed.code;
  const sourceMapGenerator = parsed.map;
  const mappings: CodeMapping[] = generateMappingsFromSourceMap(
    sourceMapGenerator,
    scriptText,
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

function generateMappingsFromSourceMap(
  sourceMapGenerator: SourceMapGenerator,
  generatedCode: string,
): CodeMapping[] {
  const mappings: CodeMapping[] = [];

  // Convert SourceMapGenerator to JSON
  const sourceMap = sourceMapGenerator.toJSON();

  // Parse the source map and extract mappings
  if (sourceMap && sourceMap.mappings) {
    // Use source-map-js to decode the mappings
    const consumer = new SourceMapConsumer(sourceMap);

    try {
      const sourceContent = sourceMap.sourcesContent?.[0] || "";

      // Collect all mappings first to calculate lengths
      const allMappings: Array<{
        sourceOffset: number;
        generatedOffset: number;
        originalMapping: MappingItem;
      }> = [];

      // Iterate through all mappings in the source map
      consumer.eachMapping((mapping: MappingItem) => {
        if (mapping.originalLine !== null && mapping.originalColumn !== null) {
          // Convert line/column to offsets
          // Note: source-map uses 1-based lines, 0-based columns
          const sourceOffset = convertLineColumnToOffset(
            mapping.originalLine - 1,
            mapping.originalColumn,
            sourceContent,
          );
          const generatedOffset = convertLineColumnToOffset(
            mapping.generatedLine - 1,
            mapping.generatedColumn,
            generatedCode,
          );

          allMappings.push({
            sourceOffset,
            generatedOffset,
            originalMapping: mapping,
          });
        }
      });

      // Sort mappings by generated offset to calculate lengths correctly
      allMappings.sort((a, b) => a.generatedOffset - b.generatedOffset);

      // Now create mappings with proper lengths
      for (let i = 0; i < allMappings.length; i++) {
        const current = allMappings[i];
        const next = allMappings[i + 1];

        // Calculate length to next mapping, or to end of respective content
        let generatedLength: number;
        let sourceLength: number;

        if (next) {
          // Length is the distance to the next mapping
          generatedLength = next.generatedOffset - current.generatedOffset;

          // For source length, we need to be more careful since mappings might not be in source order
          // Find the next mapping in source order
          const nextInSourceOrder = allMappings
            .filter((m) => m.sourceOffset > current.sourceOffset)
            .sort((a, b) => a.sourceOffset - b.sourceOffset)[0];

          if (nextInSourceOrder) {
            sourceLength =
              nextInSourceOrder.sourceOffset - current.sourceOffset;
          } else {
            sourceLength = Math.min(
              generatedLength,
              sourceContent.length - current.sourceOffset,
            );
          }
        } else {
          // Last mapping - extend to end of content or reasonable default
          generatedLength = Math.min(
            32,
            generatedCode.length - current.generatedOffset,
          );
          sourceLength = Math.min(
            generatedLength,
            sourceContent.length - current.sourceOffset,
          );
        }

        // Ensure we don't have negative or zero lengths
        generatedLength = Math.max(1, generatedLength);
        sourceLength = Math.max(1, sourceLength);

        mappings.push({
          sourceOffsets: [current.sourceOffset],
          generatedOffsets: [current.generatedOffset],
          lengths: [sourceLength],
          generatedLengths: [generatedLength],
          data: {
            completion: true,
            format: false,
            navigation: true,
            semantic: true,
            structure: true,
            verification: true,
          },
        });
      }
    } finally {
      // consumer.destroy(); // Skip this as it might not be available in all versions
    }
  }

  return mappings;
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
