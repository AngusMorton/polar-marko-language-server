import snap from "mocha-snap";
import { setTimeout } from "timers/promises";
import vscode from "vscode";

import {
  getTestDoc,
  getTestEditor,
  relativeToTempDir,
  updateTestDoc,
  writeTestFiles,
} from "./setup.test";

describe("definition", () => {
  it("tag name", async () => {
    await writeTestFiles({
      "components/example.marko": "<div/>",
    });
    await snap.inline(
      () => definition("<example█/>"),
      `components/example.marko`,
    );
  });
});

async function definition(src: string) {
  await updateTestDoc(src);
  const location = await waitForDefinition(src);

  return relativeToTempDir(location.targetUri.fsPath);
}

async function waitForDefinition(src: string) {
  const start = Date.now();

  do {
    const location = await getDefinition();

    if (location) return location;
    await setTimeout(100);
    await updateTestDoc(src);
  } while (Date.now() - start < 5000);

  const { line, character } = getTestEditor().selection.start;
  throw new Error(
    `No definition found within 5000ms at ${line}:${character} in ${getTestDoc().uri.fsPath}`,
  );
}

async function getDefinition() {
  const [location] = await vscode.commands.executeCommand<
    vscode.LocationLink[]
  >(
    "vscode.executeDefinitionProvider",
    getTestDoc().uri,
    getTestEditor().selection.start,
  );

  return location;
}
