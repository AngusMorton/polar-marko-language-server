import { Project } from "@marko/language-tools";
import { createLanguageServicePlugin } from "@volar/typescript/lib/quickstart/createLanguageServicePlugin.js";

import { addMarkoTypes, createMarkoLanguagePlugin } from "../language";

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
    },
  };
});
