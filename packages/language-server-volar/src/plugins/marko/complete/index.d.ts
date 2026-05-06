import { CompletionItem } from "vscode-languageserver";

import { MarkoVirtualCode } from "../../../language";
export declare function provideCompletions(
  doc: MarkoVirtualCode,
  offset: number,
): CompletionItem[] | undefined;
