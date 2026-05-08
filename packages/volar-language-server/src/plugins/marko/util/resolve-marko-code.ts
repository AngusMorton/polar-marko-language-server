import type { LanguageServiceContext } from "@volar/language-service";
import type { Position } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { MarkoVirtualCode } from "../../../language";

export function resolveMarkoCode(
  context: LanguageServiceContext,
  documentUri: string,
) {
  const uri = URI.parse(documentUri);
  const decoded = context.decodeEmbeddedDocumentUri(uri);

  if (!decoded) {
    const sourceScript = context.language.scripts.get(uri);
    const root = sourceScript?.generated?.root;
    if (sourceScript && root instanceof MarkoVirtualCode) {
      return { sourceScript, root };
    }
    return;
  }

  const sourceScript = context.language.scripts.get(decoded[0]);
  const root = sourceScript?.generated?.root;
  if (!sourceScript || !(root instanceof MarkoVirtualCode)) {
    return;
  }

  if (decoded[1] === root.id) {
    return { sourceScript, root };
  }

  const embeddedCode = sourceScript.generated?.embeddedCodes.get(decoded[1]);
  if (embeddedCode) {
    return { sourceScript, root, embeddedCode };
  }
}

export function resolveSourceMarkoOffset(
  context: LanguageServiceContext,
  document: TextDocument,
  position: Position,
) {
  const info = resolveMarkoCode(context, document.uri);
  if (!info) return;

  if (!info.embeddedCode) {
    return { virtualCode: info.root, offset: document.offsetAt(position) };
  }

  const map = context.language.maps.get(info.embeddedCode, info.sourceScript);
  const embeddedOffset = document.offsetAt(position);
  for (const [sourceOffset] of map.toSourceLocation(embeddedOffset)) {
    return { virtualCode: info.root, offset: sourceOffset };
  }
}
