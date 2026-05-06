import type { Node } from "@marko/language-tools";
import { LocationLink } from "@volar/language-service";

import { MarkoVirtualCode } from "../../../language";
export declare function AttrName(
  node: Node.AttrName,
  file: MarkoVirtualCode,
): LocationLink[] | undefined;
