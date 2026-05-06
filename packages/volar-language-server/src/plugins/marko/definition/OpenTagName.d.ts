import type { Node } from "@marko/language-tools";
import { LocationLink } from "@volar/language-service";

import { MarkoVirtualCode } from "../../../language";
export declare function OpenTagName(
  node: Node.OpenTagName,
  file: MarkoVirtualCode,
): LocationLink[] | undefined;
