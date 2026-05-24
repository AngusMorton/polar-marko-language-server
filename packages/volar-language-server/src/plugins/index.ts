import type { Connection } from "@volar/language-server";
import { create as createCssService } from "volar-service-css";
import { create as createTypeScriptTwoSlashService } from "volar-service-typescript-twoslash-queries";

import { create as createMarkoService } from "./marko";
import { create as createAccessibilityService } from "./marko-accessibility";
import { create as createMarkoFormatActionService } from "./marko-action-format";
import { create as createMarkoDebugService } from "./marko-debug";
import { create as createMarkoDocumentLinksService } from "./marko-document-links";
import { create as createMarkoDocumentSymbolsService } from "./marko-document-symbols";
import { create as createMarkoTemplateService } from "./marko-template";
import {
  createMarkoTsServer,
  type SendTsServerRequest,
} from "./marko-template/tsserver";
import { createMarkoPrettierService } from "./prettier";
import { create as createTypeScriptServices } from "./typescript";

export function getLanguageServicePlugins(
  connection: Connection,
  ts: typeof import("typescript"),
  sendTsServerRequest: SendTsServerRequest,
  getComponentMetaCacheVersion?: () => string | number | undefined,
) {
  const result = [
    createMarkoService(ts),
    createMarkoDocumentLinksService(),
    createMarkoDocumentSymbolsService(),
    createMarkoTemplateService(
      ts,
      createMarkoTsServer(sendTsServerRequest, getComponentMetaCacheVersion),
    ),
    createCssService(),
    ...createTypeScriptServices(ts),
    createTypeScriptTwoSlashService(ts),
    createMarkoPrettierService(connection),
    createAccessibilityService(),
    createMarkoDebugService(),
    createMarkoFormatActionService(),
  ];
  return result;
}
