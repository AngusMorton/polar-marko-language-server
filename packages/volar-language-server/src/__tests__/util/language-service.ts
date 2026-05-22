import {
  type ComponentMetaChecker,
  createChecker,
  extractTagMetaFromProgram,
  resolveTagFile,
} from "@marko/component-meta";
import { Project } from "@marko/language-tools";
import { LanguageServerHandle, startLanguageServer } from "@volar/test-utils";
import fs from "fs";
import path from "path";
import ts from "typescript";
import * as protocol from "vscode-languageserver-protocol/node";
import { URI } from "vscode-uri";

const rootDir = path.resolve(__dirname, "../fixtures");

let serverHandle: LanguageServerHandle | undefined;
let languageService: TestLanguageService | undefined;
let componentMetaChecker: ComponentMetaChecker | undefined;

Project.setDefaultTypePaths({
  internalTypesFile:
    require.resolve("@marko/language-tools/marko.internal.d.ts"),
  markoTypesFile: require.resolve("marko/index.d.ts"),
});

export async function getLanguageServer() {
  // Use the fixtures directory as the workspace root for proper type resolution
  const fixturesDir = rootDir;
  const capabilities: protocol.ClientCapabilities = {
    textDocument: {
      completion: {
        completionItem: {
          documentationFormat: [
            protocol.MarkupKind.Markdown,
            protocol.MarkupKind.PlainText,
          ],
          insertReplaceSupport: true,
          snippetSupport: true,
        },
      },
      semanticTokens: {
        dynamicRegistration: false,
        requests: {
          full: true,
          range: true,
        },
        tokenTypes: [
          "namespace",
          "class",
          "enum",
          "interface",
          "typeParameter",
          "type",
          "parameter",
          "variable",
          "property",
          "enumMember",
          "function",
          "method",
        ],
        tokenModifiers: [
          "declaration",
          "readonly",
          "static",
          "async",
          "defaultLibrary",
          "local",
        ],
        formats: [protocol.TokenFormat.Relative],
      },
    },
  };
  const compilerOptions: ts.CompilerOptions = {
    ...ts.getDefaultCompilerOptions(),
    rootDir: fixturesDir,
    strict: true,
    skipLibCheck: true,
    noEmitOnError: true,
    noImplicitAny: true,
    esModuleInterop: true,
    skipDefaultLibCheck: true,
    allowNonTsExtensions: true,
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
  };

  if (!serverHandle) {
    serverHandle = startLanguageServer(path.resolve("./bin.js"));
    const tsdkPath = path.dirname(
      require.resolve("typescript/lib/typescript.js"),
    );
    languageService = createTestLanguageService(fixturesDir, compilerOptions);
    componentMetaChecker = createChecker(
      path.join(fixturesDir, "tsconfig.json"),
      {
        noDeclarations: false,
      },
    );
    serverHandle.connection.onNotification(
      "tsserver/request",
      ([id, command, args]: [
        number,
        string,
        { fileName: string; tagFileName?: string; tagName: string },
      ]) => {
        if (command !== "_marko:getComponentMeta") {
          return serverHandle?.connection.sendNotification(
            "tsserver/response",
            [id, undefined],
          );
        }

        const program = languageService?.service.getProgram();
        const fileName = args.tagFileName
          ? normalizeTagFileName(args.fileName, args.tagFileName)
          : resolveTagFile(args.fileName, args.tagName);
        return serverHandle?.connection.sendNotification("tsserver/response", [
          id,
          fileName
            ? (componentMetaChecker?.getTagMeta(fileName) ??
              (program
                ? extractTagMetaFromProgram(ts, program, fileName)
                : undefined))
            : undefined,
        ]);
      },
    );

    // Initialize the server with the fixtures directory as the root workspace
    await serverHandle.initialize(
      fixturesDir,
      {
        typescript: { tsdk: tsdkPath, compilerOptions },
      },
      capabilities,
    );
    syncTestLanguageServiceDocuments(serverHandle, languageService);

    // Ensure that our first test does not suffer from a TypeScript overhead
    await serverHandle.sendCompletionRequest(
      "file://does-not-exist",
      protocol.Position.create(0, 0),
    );
  }

  return serverHandle;
}

export async function shutdownLanguageServer() {
  if (!serverHandle) {
    return;
  }

  await serverHandle.shutdown();
  serverHandle.connection.sendNotification(protocol.ExitNotification.type);
  serverHandle = undefined;
  languageService = undefined;
  componentMetaChecker = undefined;
}

type TestLanguageService = {
  service: ts.LanguageService;
  closeScript(fileName: string): void;
  updateScript(fileName: string, text: string): void;
};

export function loadMarkoFiles(dir: string, all = new Set<string>()) {
  for (const entry of fs.readdirSync(dir)) {
    const file = path.join(dir, entry);
    const stat = fs.statSync(file);
    if (stat.isFile()) {
      all.add(file);
    } else if (stat.isDirectory() && entry !== "__snapshots__") {
      loadMarkoFiles(file, all);
    }
  }

  return all;
}

function createTestLanguageService(
  rootDir: string,
  compilerOptions: ts.CompilerOptions,
) {
  const snapshots = new Map<string, ts.IScriptSnapshot>();
  const versions = new Map<string, number>();
  const files = new Set([...loadMarkoFiles(rootDir)].map(normalizePath));
  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => compilerOptions,
    getCurrentDirectory: () => rootDir,
    getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
    getScriptFileNames: () => [...files],
    getScriptSnapshot(fileName) {
      fileName = normalizePath(fileName);
      let snapshot = snapshots.get(fileName);
      if (!snapshot) {
        const text = ts.sys.readFile(fileName);
        if (text === undefined) {
          return;
        }
        snapshot = ts.ScriptSnapshot.fromString(text);
        snapshots.set(fileName, snapshot);
      }
      return snapshot;
    },
    getScriptVersion: (fileName) =>
      String(versions.get(normalizePath(fileName)) ?? 0),
    readFile: ts.sys.readFile,
    fileExists: ts.sys.fileExists,
  };
  return {
    service: ts.createLanguageService(host),
    closeScript(fileName: string) {
      fileName = normalizePath(fileName);
      snapshots.delete(fileName);
      versions.set(fileName, (versions.get(fileName) ?? 0) + 1);
    },
    updateScript(fileName: string, text: string) {
      fileName = normalizePath(fileName);
      files.add(fileName);
      snapshots.set(fileName, ts.ScriptSnapshot.fromString(text));
      versions.set(fileName, (versions.get(fileName) ?? 0) + 1);
    },
  };
}

function syncTestLanguageServiceDocuments(
  server: LanguageServerHandle,
  languageService: TestLanguageService,
) {
  const openInMemoryDocument = server.openInMemoryDocument.bind(server);
  server.openInMemoryDocument = async (uri, languageId, content) => {
    const document = await openInMemoryDocument(uri, languageId, content);
    languageService.updateScript(URI.parse(uri).fsPath, document.getText());
    updateComponentMetaDocument(uri, document.getText());
    return document;
  };

  const openTextDocument = server.openTextDocument.bind(server);
  server.openTextDocument = async (fileName, languageId) => {
    const document = await openTextDocument(fileName, languageId);
    languageService.updateScript(fileName, document.getText());
    updateComponentMetaDocument(
      URI.file(fileName).toString(),
      document.getText(),
    );
    return document;
  };

  const updateTextDocument = server.updateTextDocument.bind(server);
  server.updateTextDocument = async (uri, edits) => {
    const document = await updateTextDocument(uri, edits);
    languageService.updateScript(URI.parse(uri).fsPath, document.getText());
    updateComponentMetaDocument(uri, document.getText());
    return document;
  };

  const closeTextDocument = server.closeTextDocument.bind(server);
  server.closeTextDocument = async (uri) => {
    const fileName = URI.parse(uri).fsPath;
    await closeTextDocument(uri);
    languageService.closeScript(fileName);
    if (isTagLikeFile(fileName)) {
      componentMetaChecker?.clearCache();
    }
  };
}

function updateComponentMetaDocument(uri: string, text: string) {
  const fileName = URI.parse(uri).fsPath;
  if (isTagLikeFile(fileName)) {
    componentMetaChecker?.updateFile(fileName, text);
  }
}

function isTagLikeFile(fileName: string) {
  return /[\\/](?:components|tags)[\\/]/.test(fileName);
}

function normalizeTagFileName(importerFileName: string, tagFileName: string) {
  return path.isAbsolute(tagFileName)
    ? tagFileName
    : path.resolve(path.dirname(importerFileName), tagFileName);
}

function normalizePath(fileName: string) {
  return fileName.replace(/\\/g, "/");
}
