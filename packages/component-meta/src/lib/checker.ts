import { Project } from "@marko/language-tools";
import type ts from "typescript";

import { createPatchedHost, type ExtractedFile } from "./host";
import { extractTagMeta, getVisibleTagNames, resolveTagFile } from "./meta";
import type { MetaCheckerOptions } from "./types";

export function createCheckerBase(
  tsModule: typeof import("typescript"),
  getConfigAndFiles: () => [
    commandLine: ts.ParsedCommandLine,
    fileNames: string[],
  ],
  _checkerOptions: MetaCheckerOptions,
  _rootPath: string,
) {
  let [commandLine, fileNames] = getConfigAndFiles();
  let fileNamesSet = new Set(fileNames.map(normalizePath));
  let projectVersion = 0;

  const extractCache = new Map<string, ExtractedFile | undefined>();
  const scriptSnapshots = new Map<string, ts.IScriptSnapshot | undefined>();
  const deletedFiles = new Set<string>();
  const metaCache = new Map<string, ReturnType<typeof extractTagMeta>>();
  let programCache: ts.Program | undefined;

  return {
    getTagNames(importerFileName: string) {
      return getVisibleTagNames(normalizePath(importerFileName));
    },
    getTagMetaForTag(importerFileName: string, tagName: string) {
      const fileName = resolveTagFile(normalizePath(importerFileName), tagName);
      return fileName ? this.getTagMeta(fileName) : undefined;
    },
    getTagMeta(fileName: string) {
      fileName = normalizePath(fileName);
      const cached = metaCache.get(fileName);
      if (cached) {
        return cached;
      }

      const [program, sourceFile] = getProgramAndFile(fileName);
      const extracted = extractCache.get(fileName);
      const meta = extractTagMeta(
        tsModule,
        program.getTypeChecker(),
        sourceFile,
        extracted,
      );
      metaCache.set(fileName, meta);
      return meta;
    },
    updateFile(fileName: string, text: string) {
      fileName = normalizePath(fileName);
      deletedFiles.delete(fileName);
      scriptSnapshots.set(fileName, tsModule.ScriptSnapshot.fromString(text));
      fileNamesSet.add(fileName);
      touch(fileName);
    },
    deleteFile(fileName: string) {
      fileName = normalizePath(fileName);
      deletedFiles.add(fileName);
      scriptSnapshots.delete(fileName);
      fileNamesSet.delete(fileName);
      touch(fileName);
    },
    reload() {
      [commandLine, fileNames] = getConfigAndFiles();
      fileNamesSet = new Set(fileNames.map(normalizePath));
      deletedFiles.clear();
      this.clearCache();
    },
    clearCache() {
      scriptSnapshots.clear();
      extractCache.clear();
      metaCache.clear();
      Project.clearCaches();
      programCache = undefined;
      projectVersion++;
    },
    getProgram() {
      return getProgram();
    },
  };

  function touch(fileName: string) {
    extractCache.delete(fileName);
    metaCache.delete(fileName);
    programCache = undefined;
    projectVersion++;
  }

  function getProgramAndFile(fileName: string) {
    let program = getProgram();
    let sourceFile = program.getSourceFile(fileName);
    if (!sourceFile) {
      const virtualFileName = getPatchedHost().toVirtualFileName(fileName);
      sourceFile = program.getSourceFile(virtualFileName);
    }
    if (!sourceFile) {
      fileNamesSet.add(fileName);
      programCache = undefined;
      projectVersion++;
      program = getProgram();
      sourceFile = program.getSourceFile(fileName);
      if (!sourceFile) {
        const virtualFileName = getPatchedHost().toVirtualFileName(fileName);
        sourceFile = program.getSourceFile(virtualFileName);
      }
    }
    if (!sourceFile) {
      throw new Error(`Could not load Marko source file: ${fileName}`);
    }
    return [program, sourceFile] as const;
  }

  function getProgram() {
    if (programCache) {
      return programCache;
    }

    const { host, rootNames } = getPatchedHost();

    programCache = tsModule.createProgram({
      rootNames: [
        ...new Set([
          ...rootNames,
          ...[...fileNamesSet].map((fileName) =>
            getPatchedHost().toVirtualFileName(fileName),
          ),
        ]),
      ],
      options: commandLine.options,
      host,
    });
    return programCache;
  }

  function getPatchedHost() {
    return createPatchedHost(
      tsModule,
      getConfigFilePath(commandLine.options.configFilePath),
      commandLine.options,
      {
        extractCache,
        readFile(fileName) {
          fileName = normalizePath(fileName);
          if (deletedFiles.has(fileName)) {
            return undefined;
          }
          const snapshot = scriptSnapshots.get(fileName);
          if (snapshot) {
            return snapshot.getText(0, snapshot.getLength());
          }
          return tsModule.sys.readFile(fileName);
        },
        fileExists(fileName) {
          fileName = normalizePath(fileName);
          if (deletedFiles.has(fileName)) {
            return false;
          }
          return (
            scriptSnapshots.has(fileName) || tsModule.sys.fileExists(fileName)
          );
        },
      },
    );
  }
}

function normalizePath(fileName: string) {
  return fileName.replace(/\\/g, "/");
}

function getConfigFilePath(value: ts.CompilerOptions["configFilePath"]) {
  return typeof value === "string" ? value : undefined;
}
