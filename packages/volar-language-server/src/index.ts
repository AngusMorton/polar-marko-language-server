import { addMarkoTypes, createMarkoLanguagePlugin } from "@marko/language-core";
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

import { getLanguageServicePlugins } from "./plugins";

const connection = createConnection();
const server = createServer(connection);
const bundledMarkoTypesFile = path.join(__dirname, "marko.runtime.d.ts");
const notifiedBundledTypeFallback = new Set<string>();
const pendingTsServerRequests = new Map<
  number,
  {
    resolve(response: unknown): void;
  }
>();
let tsServerRequestId = 0;
let componentMetaCacheVersion = 0;

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

      const getRuntimeTypesCode = () => {
        if (!rootPath || !languageServiceHost) return;

        return Project.getTypeLibs(rootPath, typescript, languageServiceHost)
          .markoTypesCode;
      };

      return {
        languagePlugins: [
          createMarkoLanguagePlugin(
            typescript,
            (uri: URI) => uri.fsPath.replace(/\\/g, "/"),
            getRuntimeTypesCode,
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
    getLanguageServicePlugins(
      connection,
      typescript,
      sendTsServerRequest,
      () => componentMetaCacheVersion,
    ),
  );
});

connection.onNotification(
  "tsserver/response",
  ([id, response]: [number, unknown]) => {
    const pending = pendingTsServerRequests.get(id);
    if (!pending) {
      return;
    }

    pendingTsServerRequests.delete(id);
    pending.resolve(response);
  },
);

connection.onInitialized(() => {
  server.initialized();
  server.documents.onDidOpen(({ document }) => {
    if (isComponentMetaFile(document.uri)) {
      componentMetaCacheVersion++;
    }
  });
  server.documents.onDidChangeContent(({ document }) => {
    if (isComponentMetaFile(document.uri)) {
      componentMetaCacheVersion++;
    }
  });
  server.documents.onDidClose(({ document }) => {
    if (isComponentMetaFile(document.uri)) {
      componentMetaCacheVersion++;
    }
  });
  server.fileWatcher.onDidChangeWatchedFiles(({ changes }) => {
    Project.clearCaches();
    if (changes.some((change) => isComponentMetaFile(change.uri))) {
      componentMetaCacheVersion++;
    }
  });
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

function sendTsServerRequest<T>(command: string, args: unknown) {
  const id = ++tsServerRequestId;
  const promise = new Promise<T>((resolve) => {
    pendingTsServerRequests.set(id, {
      resolve: (response) => resolve(response as T),
    });
  });

  connection.sendNotification("tsserver/request", [id, command, args]);

  return promise;
}

function isComponentMetaFile(uri: string) {
  const fileName = URI.parse(uri).fsPath;
  return /[\\/](?:components|tags)[\\/].*\.(?:[cm]?[jt]s|marko)$/.test(
    fileName,
  );
}
