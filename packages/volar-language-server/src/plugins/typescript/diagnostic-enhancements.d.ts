import { CodeMapping } from "@volar/language-core";
import type { Diagnostic } from "@volar/language-server";
import { TextDocument } from "vscode-languageserver-textdocument";
export declare function enhanceDiagnosticPositions(
  diagnostics: Diagnostic[],
  document: TextDocument,
  mappings: CodeMapping[],
): Diagnostic[];
