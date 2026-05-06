import "../utils/project-defaults";

import { TaglibLookup } from "@marko/compiler/babel-utils";
import { extractHTML, parse } from "@marko/language-tools";
import { Meta } from "@marko/language-tools/src/util/project";
import type {
  CodeMapping,
  LanguagePlugin,
  VirtualCode,
} from "@volar/language-core";
import type ts from "typescript";
export declare function addMarkoTypes(
  rootDir: string,
  ts: typeof import("typescript"),
  host: ts.LanguageServiceHost,
): void;
export declare function createMarkoLanguagePlugin<T>(
  ts: typeof import("typescript"),
  asFileName: (scriptId: T) => string,
): LanguagePlugin<T, MarkoVirtualCode>;
export declare class MarkoVirtualCode implements VirtualCode {
  fileName: string;
  snapshot: ts.IScriptSnapshot;
  ts: typeof import("typescript");
  id: string;
  languageId: string;
  mappings: CodeMapping[];
  embeddedCodes: VirtualCode[];
  markoAst: ReturnType<typeof parse>;
  tagLookup: TaglibLookup;
  htmlAst: ReturnType<typeof extractHTML>;
  compiler: typeof import("@marko/compiler");
  code: string;
  project: Meta["config"];
  constructor(
    fileName: string,
    snapshot: ts.IScriptSnapshot,
    ts: typeof import("typescript"),
  );
}
