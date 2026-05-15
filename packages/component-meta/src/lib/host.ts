import {
  type Extracted,
  getExt,
  isDefinitionFile,
  Processors,
  Project,
} from "@marko/language-tools";
import crypto from "crypto";
import path from "path";
import type ts from "typescript";

const fsPathReg = /^(?:[./\\]|[A-Z]:)/i;
const modulePartsReg = /^((?:@(?:[^/]+)\/)?(?:[^/]+))(.*)$/;
const importTagReg = /^<([^>]+)>$/;
const virtualMarkoReg = /\.marko\.(?:[cm]?tsx?|[cm]?jsx?)$/;

export interface ExtractedFile extends Extracted {
  sourceFile: ts.SourceFile;
  virtualFileName: string;
}

export type CompilerHostState = {
  extractCache: Map<string, ExtractedFile | undefined>;
  readFile(fileName: string): string | undefined;
  fileExists(fileName: string): boolean;
};

export function createPatchedHost(
  tsModule: typeof import("typescript"),
  configFile: string | undefined,
  options: ts.CompilerOptions,
  state: CompilerHostState,
) {
  const host = tsModule.createCompilerHost(options, true);
  const baseReadDirectory =
    host.readDirectory?.bind(host) ?? tsModule.sys.readDirectory;
  const processors = Processors.create({
    ts: tsModule as never,
    host: {
      fileExists: state.fileExists,
      readFile: (fileName) => state.readFile(fileName),
      readDirectory: baseReadDirectory,
      directoryExists: host.directoryExists?.bind(host),
      getDirectories: host.getDirectories?.bind(host),
      getCurrentDirectory: host.getCurrentDirectory.bind(host),
    } as ts.ModuleResolutionHost,
    configFile,
  });
  const rootNames = Object.values(processors)
    .map((processor) => processor.getRootNames?.())
    .flat()
    .filter(Boolean)
    .map((fileName) =>
      toVirtualFileName(fileName as string, processors),
    ) as string[];
  const resolutionCache = tsModule.createModuleResolutionCache(
    host.getCurrentDirectory(),
    host.getCanonicalFileName.bind(host),
    options,
  );

  const baseReadFile = host.readFile.bind(host);
  host.readFile = (fileName) => {
    const realFileName = toRealFileName(fileName);
    const extracted = getExtracted(realFileName);
    if (extracted && extracted.virtualFileName === fileName) {
      return extracted.toString();
    }

    return state.readFile(realFileName) ?? baseReadFile(realFileName);
  };

  const baseFileExists = host.fileExists.bind(host);
  host.fileExists = (fileName) => {
    const realFileName = toRealFileName(fileName);
    if (realFileName !== fileName) {
      return state.fileExists(realFileName) || baseFileExists(realFileName);
    }

    return state.fileExists(realFileName) || baseFileExists(realFileName);
  };

  host.readDirectory = (dir, extensions, exclude, include, depth) => {
    return baseReadDirectory(
      dir,
      extensions?.concat(Processors.extensions),
      exclude,
      include,
      depth,
    );
  };

  const baseGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    fileName,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const realFileName = toRealFileName(fileName);
    const extracted = getExtracted(realFileName);
    if (extracted && extracted.virtualFileName === fileName) {
      return extracted.sourceFile;
    }

    const sourceFile = baseGetSourceFile(
      realFileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile,
    );
    if (sourceFile) {
      setSourceFileVersion(sourceFile);
    }
    return sourceFile;
  };

  host.getSourceFileByPath = undefined;

  host.resolveModuleNameLiterals = (
    moduleLiterals,
    containingFile,
    redirectedReference,
    compilerOptions,
  ) => {
    return moduleLiterals.map((moduleLiteral) => {
      let moduleName = moduleLiteral.text;
      const containingRealFile = toRealFileName(containingFile);

      const tagNameMatch = importTagReg.exec(moduleName);
      if (tagNameMatch) {
        const [, tagName] = tagNameMatch;
        const tagDef = Project.getTagLookup(
          path.dirname(containingRealFile),
        ).getTag(tagName);
        const tagFileName = tagDef && (tagDef.template || tagDef.renderer);
        if (tagFileName) {
          moduleName = tagFileName;
        }
      }

      const processor =
        moduleName[0] !== "*" ? getProcessor(moduleName) : undefined;
      if (processor) {
        let resolvedFileName: string | undefined;
        let isExternalLibraryImport = false;

        if (fsPathReg.test(moduleName)) {
          resolvedFileName = path.resolve(containingRealFile, "..", moduleName);
        } else {
          const [, nodeModuleName, relativeModulePath] =
            modulePartsReg.exec(moduleName)!;
          const { resolvedModule } = tsModule.nodeModuleNameResolver(
            `${nodeModuleName}/package.json`,
            containingRealFile,
            compilerOptions,
            host,
            resolutionCache,
            redirectedReference,
          );
          if (resolvedModule) {
            isExternalLibraryImport = true;
            resolvedFileName = path.join(
              resolvedModule.resolvedFileName,
              "..",
              relativeModulePath,
            );
          }
        }

        if (resolvedFileName) {
          if (isDefinitionFile(resolvedFileName)) {
            if (!host.fileExists(resolvedFileName)) {
              resolvedFileName = undefined;
            }
          } else {
            const ext = getExt(resolvedFileName);
            if (!ext) {
              resolvedFileName = undefined;
            } else {
              const definitionFile = `${resolvedFileName.slice(0, -ext.length)}.d${ext}`;
              if (host.fileExists(definitionFile)) {
                resolvedFileName = definitionFile;
              } else if (!host.fileExists(resolvedFileName)) {
                resolvedFileName = undefined;
              }
            }
          }
        }

        return {
          resolvedModule: resolvedFileName
            ? {
                resolvedFileName: toVirtualFileName(
                  resolvedFileName,
                  processors,
                ),
                extension: processor.getScriptExtension(resolvedFileName),
                isExternalLibraryImport,
              }
            : undefined,
        } satisfies ts.ResolvedModuleWithFailedLookupLocations;
      }

      const { resolvedModule } = tsModule.resolveModuleName(
        moduleName,
        containingRealFile,
        compilerOptions,
        host,
        resolutionCache,
        redirectedReference,
      );
      return {
        resolvedModule,
      } satisfies ts.ResolvedModuleWithFailedLookupLocations;
    });
  };

  function getProcessor(fileName: string) {
    return processors[getExt(toRealFileName(fileName)) || ".marko"];
  }

  function getExtracted(fileName: string) {
    fileName = normalizePath(fileName);
    if (state.extractCache.has(fileName)) {
      return state.extractCache.get(fileName);
    }

    const processor = getProcessor(fileName);
    if (!processor) {
      return undefined;
    }

    const code = state.readFile(fileName) ?? "";
    try {
      const extracted = processor.extract(fileName, code);
      const virtualFileName = toVirtualFileName(fileName, processors);
      const sourceFile = tsModule.createSourceFile(
        virtualFileName,
        extracted.toString(),
        options.target ?? tsModule.ScriptTarget.Latest,
        true,
        processor.getScriptKind(fileName),
      );
      setSourceFileVersion(sourceFile);
      const result = Object.assign(extracted, {
        sourceFile,
        virtualFileName,
      }) as ExtractedFile;
      state.extractCache.set(fileName, result);
      return result;
    } catch {
      state.extractCache.set(fileName, undefined);
      return undefined;
    }
  }

  return {
    host,
    rootNames,
    toVirtualFileName: (fileName: string) =>
      toVirtualFileName(fileName, processors),
    toRealFileName,
  };
}

function toVirtualFileName(
  fileName: string,
  processors: Record<Processors.ProcessorExtension, Processors.Processor>,
) {
  fileName = normalizePath(fileName);
  const processor = processors[getExt(fileName) || ".marko"];
  if (!processor) {
    return fileName;
  }

  return `${fileName}${processor.getScriptExtension(fileName)}`;
}

function toRealFileName(fileName: string) {
  fileName = normalizePath(fileName);
  return virtualMarkoReg.test(fileName)
    ? fileName.replace(/\.(?:[cm]?tsx?|[cm]?jsx?)$/, "")
    : fileName;
}

function normalizePath(fileName: string) {
  return fileName.replace(/\\/g, "/");
}

function setSourceFileVersion(sourceFile: ts.SourceFile) {
  (sourceFile as { version?: string }).version = crypto
    .createHash("md5")
    .update(sourceFile.text)
    .digest("hex");
}
