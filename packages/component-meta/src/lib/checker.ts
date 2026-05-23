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
  const scriptFiles = new Map<
    string,
    { snapshot: ts.IScriptSnapshot; version: number }
  >();
  const deletedFiles = new Set<string>();
  const metaCache = new Map<
    string,
    {
      fileVersion: number;
      projectVersion: number;
      meta: ReturnType<typeof extractTagMeta>;
    }
  >();
  let projectVersion = 0;
  let patchedHost: ReturnType<typeof createPatchedHost> | undefined;
  let languageService: ts.LanguageService | undefined;

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
    getCachedTagMeta(fileName: string) {
      fileName = normalizePath(fileName);
      const fileVersion = getFileVersion(fileName);
      const cached = metaCache.get(fileName);
      return cached?.fileVersion === fileVersion &&
        cached.projectVersion === projectVersion
        ? cached.meta
        : undefined;
    },
    getTagMeta(fileName: string) {
      fileName = normalizePath(fileName);
      const cached = this.getCachedTagMeta(fileName);
      if (cached) {
        return cached;
      }

      const fileVersion = getFileVersion(fileName);
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
      metaCache.set(fileName, { fileVersion, projectVersion, meta });
      return meta;
    },
    updateFile(fileName: string, text: string) {
      fileName = normalizePath(fileName);
      deletedFiles.delete(fileName);
      scriptFiles.set(fileName, {
        snapshot: tsModule.ScriptSnapshot.fromString(text),
        version: getFileVersion(fileName) + 1,
      });
      fileNamesSet.add(fileName);
      touch(fileName, false);
    },
    closeFile(fileName: string) {
      fileName = normalizePath(fileName);
      deletedFiles.delete(fileName);
      scriptFiles.delete(fileName);
      if (!tsModule.sys.fileExists(fileName)) {
        fileNamesSet.delete(fileName);
      }
      touch(fileName, false);
    },
    deleteFile(fileName: string) {
      fileName = normalizePath(fileName);
      deletedFiles.add(fileName);
      scriptFiles.delete(fileName);
      fileNamesSet.delete(fileName);
      touch(fileName, true);
    },
    reload() {
      [commandLine, fileNames] = getConfigAndFiles();
      fileNamesSet = new Set(fileNames.map(normalizePath));
      deletedFiles.clear();
      scriptFiles.clear();
      this.clearCache();
    },
    clearCache() {
      extractCache.clear();
      metaCache.clear();
      Project.clearCaches();
      projectVersion++;
      patchedHost = undefined;
      languageService?.dispose();
      languageService = undefined;
    },
    getProgram() {
      return getProgram();
    },
  };

  return checker;

  function touch(fileName: string, clearProjectCaches: boolean) {
    extractCache.delete(fileName);
    metaCache.delete(fileName);
    if (clearProjectCaches) {
      Project.clearCaches();
    }
    projectVersion++;
  }

  function getProgramAndFile(fileName: string) {
    let program = getProgram();
    let sourceFile = getSourceFile(program, fileName);
    if (!sourceFile) {
      fileNamesSet.add(fileName);
      projectVersion++;
      program = getProgram();
      sourceFile = getSourceFile(program, fileName);
    }
    if (!sourceFile) {
      throw new Error(`Could not load Marko source file: ${fileName}`);
    }
    return [program, sourceFile] as const;
  }

  function getSourceFile(program: ts.Program, fileName: string) {
    const virtualFileName = getPatchedHost().toVirtualFileName(fileName);
    if (fileName.endsWith(".marko")) {
      return (
        program.getSourceFile(virtualFileName) ??
        program.getSourceFile(fileName)
      );
    }

    return (
      program.getSourceFile(fileName) ?? program.getSourceFile(virtualFileName)
    );
  }

  function getProgram() {
    return getLanguageService().getProgram()!;
  }

  function getLanguageService() {
    return (languageService ??= tsModule.createLanguageService(
      createLanguageServiceHost(),
    ));
  }

  function createLanguageServiceHost(): ts.LanguageServiceHost {
    const patched = getPatchedHost();
    return {
      getCompilationSettings: () => commandLine.options,
      getCurrentDirectory: patched.host.getCurrentDirectory.bind(patched.host),
      getDefaultLibFileName: (options) =>
        tsModule.getDefaultLibFilePath(options),
      getProjectReferences: () => commandLine.projectReferences,
      getProjectVersion: () => String(projectVersion),
      getScriptFileNames() {
        return [
          ...new Set([
            ...patched.rootNames,
            ...[...fileNamesSet].map((fileName) =>
              patched.toVirtualFileName(fileName),
            ),
          ]),
        ];
      },
      getScriptSnapshot(fileName) {
        const source = patched.host.readFile(fileName);
        return source === undefined
          ? undefined
          : tsModule.ScriptSnapshot.fromString(source);
      },
      getScriptVersion(fileName) {
        return String(getFileVersion(patched.toRealFileName(fileName)));
      },
      fileExists: patched.host.fileExists.bind(patched.host),
      readDirectory: patched.host.readDirectory?.bind(patched.host),
      readFile: patched.host.readFile.bind(patched.host),
      resolveModuleNameLiterals: patched.host.resolveModuleNameLiterals?.bind(
        patched.host,
      ),
      useCaseSensitiveFileNames: () => tsModule.sys.useCaseSensitiveFileNames,
    };
  }

  function getPatchedHost() {
    return (patchedHost ??= createPatchedHost(
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
          const script = scriptFiles.get(fileName);
          return script
            ? script.snapshot.getText(0, script.snapshot.getLength())
            : tsModule.sys.readFile(fileName);
        },
        fileExists(fileName) {
          fileName = normalizePath(fileName);
          return (
            !deletedFiles.has(fileName) &&
            (scriptFiles.has(fileName) || tsModule.sys.fileExists(fileName))
          );
        },
      },
    ));
  }

  function getFileVersion(fileName: string) {
    return scriptFiles.get(normalizePath(fileName))?.version ?? 0;
  }
}

function normalizePath(fileName: string) {
  return fileName.replace(/\\/g, "/");
}

function getConfigFilePath(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
