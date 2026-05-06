import { Hover } from "vscode-languageserver";

import { MarkoVirtualCode } from "../../../language";
export declare function provideHover(
  doc: MarkoVirtualCode,
  offset: number,
): Hover | undefined;
