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

export interface ExtractedFile extends Extracted {
  sourceFile: ts.SourceFile;
  virtualFileName: string;
}

export type CompilerHostState = {
  extractCache: Map<string, ExtractedFile | undefined>;
  readFile(fileName: string): string | undefined;
  fileExists(fileName: string): boolean;
};

const fsPathReg = /^(?:[./\\]|[A-Z]:)/i;
const importTagReg = /^<([^>]+)>$/;
const modulePartsReg = /^((?:@(?:[^/]+)\/)?(?:[^/]+))(.*)$/;
const virtualMarkoReg = /\.marko\.(?:[cm]?tsx?|[cm]?jsx?)$/;

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
    ts: tsModule,
    host: {
      fileExists: state.fileExists,
      readFile: state.readFile,
      getCurrentDirectory: host.getCurrentDirectory.bind(host),
    },
    configFile,
  });
  const rootNames = Object.values(processors)
    .flatMap((processor) => processor.getRootNames?.() ?? [])
    .map((fileName) => toVirtualFileName(fileName, processors));
  const resolutionCache = tsModule.createModuleResolutionCache(
    host.getCurrentDirectory(),
    host.getCanonicalFileName.bind(host),
    options,
  );

  const baseReadFile = host.readFile.bind(host);
  host.readFile = (fileName) => {
    const realFileName = toRealFileName(fileName);
    if (!state.fileExists(realFileName)) {
      return;
    }
    const extracted = getExtracted(realFileName);
    if (extracted?.virtualFileName === normalizePath(fileName)) {
      return extracted.toString();
    }
    return state.readFile(realFileName) ?? baseReadFile(realFileName);
  };

  host.fileExists = (fileName) => {
    const realFileName = toRealFileName(fileName);
    return state.fileExists(realFileName);
  };

  host.readDirectory = (dir, extensions, exclude, include, depth) =>
    baseReadDirectory(
      dir,
      extensions?.concat(Processors.extensions),
      exclude,
      include,
      depth,
    );

  const baseGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (
    fileName,
    languageVersionOrOptions,
    onError,
    shouldCreateNewSourceFile,
  ) => {
    const realFileName = toRealFileName(fileName);
    if (!state.fileExists(realFileName)) {
      return;
    }
    const extracted = getExtracted(realFileName);
    if (extracted?.virtualFileName === normalizePath(fileName)) {
      return extracted.sourceFile;
    }

    const sourceFile = baseGetSourceFile(
      realFileName,
      languageVersionOrOptions,
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
  ) =>
    moduleLiterals.map((moduleLiteral) => {
      let moduleName = moduleLiteral.text;
      const containingRealFile = toRealFileName(containingFile);
      const tagNameMatch = importTagReg.exec(moduleName);
      if (tagNameMatch) {
        const [, tagName] = tagNameMatch;
        const tagDef = Project.getTagLookup(
          path.dirname(containingRealFile),
        ).getTag(tagName!);
        const tagFileName = tagDef?.template || tagDef?.renderer;
        if (tagFileName) {
          moduleName = tagFileName;
        }
      }

      const processor =
        moduleName[0] !== "*" ? getProcessor(moduleName) : undefined;
      if (!processor) {
        const resolvedModule = tsModule.resolveModuleName(
          moduleName,
          containingRealFile,
          compilerOptions,
          host,
          resolutionCache,
          redirectedReference,
        ).resolvedModule;
        return { resolvedModule };
      }

      let resolvedFileName: string | undefined;
      let isExternalLibraryImport = false;
      if (fsPathReg.test(moduleName)) {
        resolvedFileName = path.resolve(
          path.dirname(containingRealFile),
          moduleName,
        );
      } else {
        const moduleParts = modulePartsReg.exec(moduleName);
        if (moduleParts) {
          const [, nodeModuleName, relativeModulePath] = moduleParts;
          const resolvedPackage = tsModule.nodeModuleNameResolver(
            `${nodeModuleName}/package.json`,
            containingRealFile,
            compilerOptions,
            host,
            resolutionCache,
            redirectedReference,
          ).resolvedModule;
          if (resolvedPackage) {
            isExternalLibraryImport = true;
            resolvedFileName = path.join(
              path.dirname(resolvedPackage.resolvedFileName),
              relativeModulePath!,
            );
          }
        }
      }

      if (resolvedFileName && !isDefinitionFile(resolvedFileName)) {
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
      } else if (resolvedFileName && !host.fileExists(resolvedFileName)) {
        resolvedFileName = undefined;
      }

      return {
        resolvedModule: resolvedFileName
          ? {
              resolvedFileName: toVirtualFileName(resolvedFileName, processors),
              extension: processor.getScriptExtension(resolvedFileName),
              isExternalLibraryImport,
            }
          : undefined,
      };
    });

  return {
    host,
    rootNames,
    toVirtualFileName: (fileName: string) =>
      toVirtualFileName(fileName, processors),
    toRealFileName,
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
      return;
    }

    try {
      const extracted = processor.extract(
        fileName,
        state.readFile(fileName) ?? "",
      );
      const virtualFileName = toVirtualFileName(fileName, processors);
      const sourceFile = tsModule.createSourceFile(
        virtualFileName,
        extracted.toString(),
        options.target ?? tsModule.ScriptTarget.Latest,
        true,
        processor.getScriptKind(fileName),
      );
      setSourceFileVersion(sourceFile);
      const result = Object.assign(extracted, { sourceFile, virtualFileName });
      state.extractCache.set(fileName, result);
      return result;
    } catch {
      state.extractCache.set(fileName, undefined);
      return;
    }
  }
}

function toVirtualFileName(
  fileName: string,
  processors: ReturnType<typeof Processors.create>,
) {
  fileName = normalizePath(fileName);
  const processor = processors[getExt(fileName) || ".marko"];
  return processor
    ? `${fileName}${processor.getScriptExtension(fileName)}`
    : fileName;
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
  (sourceFile as ts.SourceFile & { version?: string }).version = crypto
    .createHash("md5")
    .update(sourceFile.text)
    .digest("hex");
}
