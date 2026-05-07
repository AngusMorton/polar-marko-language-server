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
  const mappings: CodeMapping[] = [];
  for (const token of script.tokens) {
    mappings.push({
      sourceOffsets: [token.sourceStart],
      generatedOffsets: [token.generatedStart],
      lengths: [token.length],
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
