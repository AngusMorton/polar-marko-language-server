import type { Node } from "@marko/language-tools";
import { CompletionItem } from "vscode-languageserver";

import { MarkoVirtualCode } from "../../../language";
/**
 * Provide completion for the closing tag.
 */
export declare function Tag(
  node: Node.Tag,
  file: MarkoVirtualCode,
  offset: number,
): CompletionItem[] | undefined;
