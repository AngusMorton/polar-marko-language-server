import { Diagnostic } from "vscode-languageserver";

import { MarkoVirtualCode } from "../../language";
export declare function provideValidations(
  file: MarkoVirtualCode,
): Promise<Diagnostic[]>;
