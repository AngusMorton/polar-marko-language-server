import type { CompletionItem } from "@volar/language-service";

export const MARKO_TEMPLATE_SOURCE = "marko-template";
export const MARKO_HTML_EMBEDDED_CODE_ID = "html";
export const MARKO_SCRIPT_EMBEDDED_CODE_ID = "script";

export const enum MarkoCompletionKind {
  Html = "html",
  TagSymbol = "tag-symbol",
  Source = "source",
}

export interface MarkoCompletionData {
  source: typeof MARKO_TEMPLATE_SOURCE;
  kind: MarkoCompletionKind;
  embeddedCodeId?: string;
  original?: CompletionItem["data"];
}

export function isMarkoCompletionData(
  value: unknown,
): value is MarkoCompletionData {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { source?: string }).source === MARKO_TEMPLATE_SOURCE
  );
}
