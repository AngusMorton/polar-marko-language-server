import path from "path";
import ts from "typescript";

import { createCheckerBase } from "./lib/checker";
import type { MetaCheckerOptions } from "./lib/types";

export * from "./lib/types";

const extraFileExtensions = [
  {
    extension: "marko",
    isMixedContent: true,
    scriptKind: ts.ScriptKind.Deferred,
  },
] satisfies readonly ts.FileExtensionInfo[];

export function createChecker(
  tsconfig: string,
  checkerOptions: MetaCheckerOptions = {},
) {
  tsconfig = normalizePath(tsconfig);
  return createCheckerBase(
    ts,
    () => {
      const config = ts.readJsonConfigFile(tsconfig, ts.sys.readFile);
      const commandLine = ts.parseJsonSourceFileConfigFileContent(
        config,
        ts.sys,
        path.dirname(tsconfig),
        {},
        tsconfig,
        undefined,
        extraFileExtensions,
      );
      return [commandLine, commandLine.fileNames.map(normalizePath)] as const;
    },
    checkerOptions,
    path.dirname(tsconfig),
  );
}

export function createCheckerByJson(
  rootDir: string,
  json: unknown,
  checkerOptions: MetaCheckerOptions = {},
) {
  rootDir = normalizePath(rootDir);
  return createCheckerBase(
    ts,
    () => {
      const commandLine = ts.parseJsonConfigFileContent(
        json as object,
        ts.sys,
        rootDir,
        {},
        undefined,
        undefined,
        extraFileExtensions,
      );
      return [commandLine, commandLine.fileNames.map(normalizePath)] as const;
    },
    checkerOptions,
    rootDir,
  );
}

function normalizePath(fileName: string) {
  return fileName.replace(/\\/g, "/");
}
