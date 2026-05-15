import {
  createChecker,
  createCheckerByJson,
  type InputMeta,
  type TagMeta,
  type TagMetaChecker,
} from "@marko/component-meta";
import path from "path";

import type { MarkoVirtualCode } from "../../language";

const FALLBACK_CONFIG = {
  include: ["**/*"],
  compilerOptions: {
    allowNonTsExtensions: true,
    module: "NodeNext",
    moduleResolution: "NodeNext",
    skipLibCheck: true,
    strict: true,
    target: "ESNext",
  },
};

export interface MarkoComponentMetaSession {
  getTagMetaForTag(tagName: string): TagMeta | undefined;
  getInputMetaForTag(tagName: string, attrName: string): InputMeta | undefined;
}

export interface MarkoComponentMetaManager {
  prepare(root: MarkoVirtualCode): MarkoComponentMetaSession | undefined;
}

export function createComponentMetaManager(
  ts: typeof import("typescript"),
): MarkoComponentMetaManager {
  const checkers = new Map<string, TagMetaChecker | null>();

  return {
    prepare(root) {
      const checker = getChecker(root.fileName);
      if (!checker) {
        return;
      }

      checker.updateFile(root.fileName, root.code);

      return {
        getTagMetaForTag(tagName) {
          try {
            return checker.getTagMetaForTag(root.fileName, tagName);
          } catch {
            return;
          }
        },
        getInputMetaForTag(tagName, attrName) {
          return this.getTagMetaForTag(tagName)?.inputs.find(
            (input) => input.name === attrName,
          );
        },
      } satisfies MarkoComponentMetaSession;
    },
  } satisfies MarkoComponentMetaManager;

  function getChecker(fileName: string) {
    const normalizedFileName = normalizePath(fileName);
    const configPath = findConfigPath(normalizedFileName);
    const projectRoot = configPath
      ? path.dirname(configPath)
      : findProjectRoot(normalizedFileName);
    const cacheKey = configPath
      ? `config:${configPath}`
      : `root:${normalizePath(projectRoot)}`;

    let checker = checkers.get(cacheKey);
    if (checker === undefined) {
      try {
        checker = configPath
          ? createChecker(configPath)
          : createCheckerByJson(projectRoot, FALLBACK_CONFIG);
      } catch {
        checker = null;
      }

      checkers.set(cacheKey, checker);
    }

    return checker ?? undefined;
  }

  function findConfigPath(fileName: string) {
    const dir = path.dirname(fileName);
    return (
      normalizePath(
        ts.findConfigFile(dir, ts.sys.fileExists, "tsconfig.json") ||
          ts.findConfigFile(dir, ts.sys.fileExists, "jsconfig.json") ||
          "",
      ) || undefined
    );
  }

  function findProjectRoot(fileName: string) {
    const dir = path.dirname(fileName);
    const packageJson = ts.findConfigFile(
      dir,
      ts.sys.fileExists,
      "package.json",
    );
    return packageJson ? normalizePath(path.dirname(packageJson)) : dir;
  }
}

function normalizePath(fileName: string) {
  return fileName.replace(/\\/g, "/");
}
