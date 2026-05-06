import { TaglibLookup } from "@marko/compiler/babel-utils";
import { parse } from "@marko/language-tools";
import { Meta } from "@marko/language-tools/src/util/project";
import type { VirtualCode } from "@volar/language-core";
export declare function parseScripts(
  parsed: ReturnType<typeof parse>,
  ts: typeof import("typescript"),
  tagLookup: TaglibLookup,
  translator: Meta["config"]["translator"],
): VirtualCode[];
