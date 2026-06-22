import snap from "mocha-snap";

import { getTestDoc, updateTestDoc } from "./setup.test";

describe("word range", () => {
  it("dashed tag name includes separator", async () => {
    await snap.inline(
      () => wordRangeAt("<ticketable-link/>", "-"),
      `1:16:ticketable-link`,
    );
  });
});

async function wordRangeAt(src: string, text: string) {
  await updateTestDoc(src);
  const doc = getTestDoc();
  const offset = doc.getText().indexOf(text);
  if (offset === -1) {
    throw new Error(`Could not find ${JSON.stringify(text)} in test document.`);
  }

  const range = doc.getWordRangeAtPosition(doc.positionAt(offset));
  if (!range) {
    return null;
  }

  return `${doc.offsetAt(range.start)}:${doc.offsetAt(range.end)}:${doc.getText(range)}`;
}
