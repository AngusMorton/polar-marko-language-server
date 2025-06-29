import snap from "mocha-snap";
import vscode from "vscode";

import { getTestDoc, getTestEditor, updateTestDoc } from "./setup.test";

describe("hover", () => {
  it("css property", async () => {
    await snap.inline(
      () =>
        hover(
          `style {
  body {
    color█: blue;
  }
}`,
        ),
      `Sets the color of an element's text

![Baseline icon](...) _Widely available across major browsers (Baseline since 2015)_

Syntax: &lt;color&gt;

[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/color)`,
    );
  });
});

async function hover(src: string) {
  await updateTestDoc(src);
  const [hover] = await vscode.commands.executeCommand<vscode.Hover[]>(
    "vscode.executeHoverProvider",
    getTestDoc().uri,
    getTestEditor().selection.start,
  );
  return hover.contents
    .map((it) => (typeof it === "string" ? it : it.value))
    .join("\n")
    .replace(/data:[^)]*/g, "...");
}
