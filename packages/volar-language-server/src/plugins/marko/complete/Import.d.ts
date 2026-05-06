import type { Node } from "@marko/language-tools";
import { CompletionItem } from "vscode-languageserver";

import { MarkoVirtualCode } from "../../../language";
export declare function Import(
  node: Node.Import | Node.Static,
  file: MarkoVirtualCode,
): CompletionItem[] | undefined;
