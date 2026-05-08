import { Project } from "@marko/language-tools";
import { createLanguageServicePlugin } from "@volar/typescript/lib/quickstart/createLanguageServicePlugin.js";

import { addMarkoTypes, createMarkoLanguagePlugin } from "../language";

export const init = createLanguageServicePlugin((ts, info) => {
  const { languageServiceHost } = info;
  const rootPath = languageServiceHost.getCurrentDirectory();
  const getRuntimeTypes = () => {
    const typeLibs = Project.getTypeLibs(rootPath, ts, languageServiceHost);
    return {
      code: typeLibs.markoTypesCode,
      tagsBodyContentKey: typeLibs.tagsBodyContentKey,
    };
  };

  return {
    languagePlugins: [
      createMarkoLanguagePlugin(ts, (id) => id, getRuntimeTypes),
    ],
    setup(_language) {
      addMarkoTypes(rootPath, ts, languageServiceHost);
    },
  };
});
