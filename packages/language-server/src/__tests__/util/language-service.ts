import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as protocol from "vscode-languageserver-protocol/node";
import { LanguageServerHandle, startLanguageServer } from "@volar/test-utils";

let serverHandle: LanguageServerHandle | undefined;
let initializeResult: protocol.InitializeResult | undefined;

export async function getLanguageService() {
  if (!serverHandle) {
    console.log("Starting language server");
    console.log(" - bin, ", path.resolve("./bin.js"));
    serverHandle = startLanguageServer(path.resolve("./bin.js"));

    const tsdkPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../../",
      "node_modules",
      "typescript",
      "lib",
    );

    console.log("Initializing language server");
    console.log(" - tsdkPath", tsdkPath);
    initializeResult = await serverHandle.initialize(path.resolve("./"), {
      typescript: {
        tsdk: tsdkPath,
      },
    });
  }

  return { serverHandle, initializeResult };
}

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
