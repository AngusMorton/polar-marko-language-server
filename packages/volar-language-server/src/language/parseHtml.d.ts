import { extractHTML } from "@marko/language-tools";
import type { VirtualCode } from "@volar/language-core";
export declare function parseHtml(
  parsed: ReturnType<typeof extractHTML>,
): VirtualCode[];
