import { Project } from "@marko/language-tools";
import { MessageType, ShowMessageNotification } from "@volar/language-server";
import {
  createConnection,
  createServer,
  createTypeScriptProject,
  loadTsdkByPath,
} from "@volar/language-server/node";
import path from "path";
import type ts from "typescript/lib/tsserverlibrary";
import { URI } from "vscode-uri";

import { addMarkoTypes, createMarkoLanguagePlugin } from "./language";
import { getLanguageServicePlugins } from "./plugins";

const connection = createConnection();
const server = createServer(connection);
const bundledMarkoTypesFile = path.join(__dirname, "marko.runtime.d.ts");
const notifiedBundledTypeFallback = new Set<string>();

connection.listen();

connection.onInitialize((params) => {
  const tsdk = params.initializationOptions?.typescript?.tsdk;

  if (!tsdk) {
    throw new Error(
      "The `typescript.tsdk` init option is required. It should point to a directory containing a `typescript.js` or `tsserverlibrary.js` file, such as `node_modules/typescript/lib`.",
    );
  }

  const { typescript, diagnosticMessages } = loadTsdkByPath(
    tsdk,
    params.locale,
  );

  return server.initialize(
    params,
    createTypeScriptProject(typescript, diagnosticMessages, ({ env }) => {
      let rootPath: string | undefined;
      let languageServiceHost: ts.LanguageServiceHost | undefined;

      const getRuntimeTypes = () => {
        if (!rootPath || !languageServiceHost) return;

        const typeLibs = Project.getTypeLibs(
          rootPath,
          typescript,
          languageServiceHost,
        );
        return {
          code: typeLibs.markoTypesCode,
          tagsBodyContentKey: typeLibs.tagsBodyContentKey,
        };
      };

      return {
        languagePlugins: [
          createMarkoLanguagePlugin(
            typescript,
            (uri: URI) => uri.fsPath.replace(/\\/g, "/"),
            getRuntimeTypes,
          ),
        ],
        setup({ project }) {
          const { configFileName } = project.typescript!;

          languageServiceHost = project.typescript!.languageServiceHost;
          rootPath = configFileName
            ? configFileName.split("/").slice(0, -1).join("/")
            : env.workspaceFolders[0]!.fsPath;

          addMarkoTypes(rootPath, typescript, languageServiceHost);
          notifyIfUsingBundledMarkoTypes(
            rootPath,
            typescript,
            languageServiceHost,
          );
        },
      };
    }),
    getLanguageServicePlugins(connection, typescript),
  );
});

connection.onInitialized(() => {
  server.initialized();
  server.fileWatcher.onDidChangeWatchedFiles(() => Project.clearCaches());
  server.fileWatcher.watchFiles([
    `**/*.{${["js", "cjs", "mjs", "ts", "cts", "mts", "json", "marko"].join(
      ",",
    )}}`,
  ]);
});

connection.onShutdown(server.shutdown);

function notifyIfUsingBundledMarkoTypes(
  rootPath: string,
  typescript: typeof ts,
  languageServiceHost: ts.LanguageServiceHost,
) {
  const typeLibs = Project.getTypeLibs(
    rootPath,
    typescript,
    languageServiceHost,
  );

  if (
    path.normalize(typeLibs.markoTypesFile) !==
    path.normalize(bundledMarkoTypesFile)
  ) {
    return;
  }

  if (notifiedBundledTypeFallback.has(rootPath)) {
    return;
  }

  notifiedBundledTypeFallback.add(rootPath);
  connection.sendNotification(ShowMessageNotification.type, {
    message:
      "Couldn't detect `marko` installed in this workspace. Falling back to the language server's bundled Marko types, which may not match your project.",
    type: MessageType.Warning,
  });
}
