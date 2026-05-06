import type { Node } from "@marko/language-tools";
import type { CompletionItem } from "vscode-languageserver";

import { MarkoVirtualCode } from "../../../language";
export declare function AttrName(
  node: Node.AttrName,
  file: MarkoVirtualCode,
  offset: number,
): CompletionItem[] | undefined;
