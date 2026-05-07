import snap from "mocha-snap";
import timers from "timers/promises";
import vscode from "vscode";

import { getTestDoc, getTestEditor, updateTestDoc } from "./setup.test";

describe("code action", () => {
  // Ensure we wait for any pending diagnostics to be sent.
  before(() => timers.setTimeout(600));
  it("css invalid property", async () => {
    await snap.inline(
      () =>
        codeAction(
          `style {
  body {
    col█o: blue;
  }
}`,
        ),
      `Rename to 'color'`,
    );
  });
});

async function codeAction(src: string) {
  const doc = getTestDoc();
  const pendingDiagnostic = waitForNewDiagnostic();
  void updateTestDoc(src);
  await pendingDiagnostic;
  const actions = await vscode.commands.executeCommand<vscode.Command[]>(
    "vscode.executeCodeActionProvider",
    doc.uri,
    getTestEditor().selection,
  );

  return actions.find(({ title }) => title === "Rename to 'color'")?.title;
}

function waitForNewDiagnostic(): Promise<vscode.Diagnostic> {
  return new Promise((resolve) => {
    const listener = vscode.languages.onDidChangeDiagnostics((change) => {
      const [result] = vscode.languages.getDiagnostics(change.uris[0]);
      if (result) {
        listener.dispose();
        resolve(result);
      }
    });
  });
}
