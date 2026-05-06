import { LocationLink } from "vscode-languageserver";

import { MarkoVirtualCode } from "../../../language";
export declare function provideDefinitions(
  doc: MarkoVirtualCode,
  offset: number,
): LocationLink[] | undefined;
