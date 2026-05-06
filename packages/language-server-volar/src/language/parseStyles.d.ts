import { parse } from "@marko/language-tools";
import type { VirtualCode } from "@volar/language-core";
export declare function parseStyles(
  parsed: ReturnType<typeof parse>,
  taglib: any,
): VirtualCode[];
