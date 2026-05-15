import {
  extractTagMetaFromProgram,
  resolveTagFile,
} from "@marko/component-meta";
import { addMarkoTypes, createMarkoLanguagePlugin } from "@marko/language-core";
import { Project } from "@marko/language-tools";
import { createLanguageServicePlugin } from "@volar/typescript/lib/quickstart/createLanguageServicePlugin.js";

import {
  getComponentMetaRequest,
  type GetComponentMetaRequestArgs,
} from "./requests";

export const init = createLanguageServicePlugin((ts, info) => {
  const { languageServiceHost } = info;
  const rootPath = languageServiceHost.getCurrentDirectory();
  const getRuntimeTypesCode = () =>
    Project.getTypeLibs(rootPath, ts, languageServiceHost).markoTypesCode;

  return {
    languagePlugins: [
      createMarkoLanguagePlugin(ts, (id) => id, getRuntimeTypesCode),
    ],
    setup(_language) {
      addMarkoTypes(rootPath, ts, languageServiceHost);

      info.session?.addProtocolHandler(getComponentMetaRequest, (request) => {
        const args = request.arguments as GetComponentMetaRequestArgs;
        const program = info.languageService.getProgram();
        const fileName = resolveTagFile(args.fileName, args.tagName);

        return {
          response:
            program && fileName
              ? extractTagMetaFromProgram(ts, program, fileName)
              : undefined,
          responseRequired: true,
        };
      });
    },
  };
});
