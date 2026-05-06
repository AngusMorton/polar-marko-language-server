import type { Node } from "@marko/language-tools";
import { CompletionItem } from "vscode-languageserver";

import { MarkoVirtualCode } from "../../../language";
export declare function OpenTagName(
  node: Node.OpenTagName,
  file: MarkoVirtualCode,
): CompletionItem[] | undefined;
