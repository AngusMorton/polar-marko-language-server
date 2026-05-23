import {
  extractTagMetaFromProgram,
  resolveTagFile,
  type TagMeta,
} from "@marko/component-meta";
import { addMarkoTypes, createMarkoLanguagePlugin } from "@marko/language-core";
import { Project } from "@marko/language-tools";
import { createLanguageServicePlugin } from "@volar/typescript/lib/quickstart/createLanguageServicePlugin.js";
import path from "path";
import type {
  LanguageServiceHost,
  Program,
} from "typescript/lib/tsserverlibrary";

import {
  getComponentMetaRequest,
  type GetComponentMetaRequestArgs,
} from "./requests";

export const init = createLanguageServicePlugin((ts, info) => {
  const { languageServiceHost } = info;
  const rootPath = languageServiceHost.getCurrentDirectory();
  let metaCacheVersion: string | Program | undefined;
  let metaCache = new Map<string, TagMeta | undefined>();
  const getRuntimeTypesCode = () =>
    Project.getTypeLibs(rootPath, ts, languageServiceHost).markoTypesCode;

  return {
    languagePlugins: [
      createMarkoLanguagePlugin(ts, (id) => id, getRuntimeTypesCode),
    ],
    setup(_language) {
      addMarkoTypes(rootPath, ts, languageServiceHost);

      info.session?.addProtocolHandler(getComponentMetaRequest, (request) => {
        const args = request.arguments as GetComponentMetaRequestArgs;
        const fileName = args.tagFileName
          ? normalizeTagFileName(args.fileName, args.tagFileName)
          : resolveTagFile(args.fileName, args.tagName);

        let program: Program | undefined;
        let version: string | Program | undefined =
          languageServiceHost.getProjectVersion?.();

        if (version === undefined) {
          program = info.languageService.getProgram();
          version = program;
        }

        if (version !== metaCacheVersion) {
          metaCacheVersion = version;
          metaCache = new Map();
        }

        const key = fileName
          ? normalizeFileName(fileName, languageServiceHost)
          : getUnresolvedCacheKey(args);

        if (metaCache.has(key)) {
          return { response: metaCache.get(key), responseRequired: true };
        }

        program ??= info.languageService.getProgram();

        const response =
          program && fileName
            ? extractTagMetaFromProgram(ts, program, fileName)
            : undefined;
        metaCache.set(key, response);

        return {
          response,
          responseRequired: true,
        };
      });
    },
  };
});

function normalizeTagFileName(importerFileName: string, tagFileName: string) {
  return normalizePath(
    path.isAbsolute(tagFileName)
      ? path.resolve(tagFileName)
      : path.resolve(path.dirname(importerFileName), tagFileName),
  );
}

function getUnresolvedCacheKey(args: GetComponentMetaRequestArgs) {
  return `${normalizePath(args.fileName)}\0${args.tagName}`;
}

function normalizeFileName(fileName: string, host: LanguageServiceHost) {
  fileName = normalizePath(path.resolve(fileName));
  return host.useCaseSensitiveFileNames?.() === false
    ? fileName.toLowerCase()
    : fileName;
}

function normalizePath(fileName: string) {
  return fileName.replace(/\\/g, "/");
}
