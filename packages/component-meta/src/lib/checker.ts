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
  checkerOptions: MetaCheckerOptions,
  _rootPath: string,
) {
  let [commandLine, fileNames] = getConfigAndFiles();
  let fileNamesSet = new Set(fileNames.map(normalizePath));
  const extractCache = new Map<string, ExtractedFile | undefined>();
  const scriptSnapshots = new Map<string, ts.IScriptSnapshot>();
  const deletedFiles = new Set<string>();
  const metaCache = new Map<string, ReturnType<typeof extractTagMeta>>();
  let programCache: ts.Program | undefined;

  const checker = {
    getTagNames(importerFileName: string) {
      return getVisibleTagNames(normalizePath(importerFileName));
    },
    getExportNames(fileName: string) {
      fileName = normalizePath(fileName);
      const [program, sourceFile] = getProgramAndFile(fileName);
      const moduleSymbol = program
        .getTypeChecker()
        .getSymbolAtLocation(sourceFile);
      return moduleSymbol
        ? program
            .getTypeChecker()
            .getExportsOfModule(moduleSymbol)
            .map((symbol) => symbol.getName())
        : [];
    },
    getComponentMeta(fileName: string) {
      return this.getTagMeta(fileName);
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
        {
          ...checkerOptions,
          noDeclarations: checkerOptions.noDeclarations ?? true,
        },
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
    },
    getProgram() {
      return getProgram();
    },
  };

  return checker;

  function touch(fileName: string) {
    extractCache.delete(fileName);
    metaCache.delete(fileName);
    programCache = undefined;
  }

  function getProgramAndFile(fileName: string) {
    let program = getProgram();
    let sourceFile = getSourceFile(program, fileName);
    if (!sourceFile) {
      fileNamesSet.add(fileName);
      programCache = undefined;
      program = getProgram();
      sourceFile = getSourceFile(program, fileName);
    }
    if (!sourceFile) {
      throw new Error(`Could not load Marko source file: ${fileName}`);
    }
    return [program, sourceFile] as const;
  }

  function getSourceFile(program: ts.Program, fileName: string) {
    return (
      program.getSourceFile(fileName) ??
      program.getSourceFile(getPatchedHost().toVirtualFileName(fileName))
    );
  }

  function getProgram() {
    if (programCache) {
      return programCache;
    }

    const patched = getPatchedHost();
    const rootNames = [
      ...new Set([
        ...patched.rootNames,
        ...[...fileNamesSet].map((fileName) =>
          patched.toVirtualFileName(fileName),
        ),
      ]),
    ];
    programCache = tsModule.createProgram({
      rootNames,
      options: commandLine.options,
      host: patched.host,
      projectReferences: commandLine.projectReferences,
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
            return;
          }
          const snapshot = scriptSnapshots.get(fileName);
          return snapshot
            ? snapshot.getText(0, snapshot.getLength())
            : tsModule.sys.readFile(fileName);
        },
        fileExists(fileName) {
          fileName = normalizePath(fileName);
          return (
            !deletedFiles.has(fileName) &&
            (scriptSnapshots.has(fileName) || tsModule.sys.fileExists(fileName))
          );
        },
      },
    );
  }
}

function normalizePath(fileName: string) {
  return fileName.replace(/\\/g, "/");
}

function getConfigFilePath(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
