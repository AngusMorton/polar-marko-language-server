import assert from "node:assert/strict";
import path from "node:path";

import { Project } from "@marko/language-tools";

import { resolveTagFile } from "..";

Project.setDefaultTypePaths({
  internalTypesFile:
    require.resolve("@marko/language-tools/marko.internal.d.ts"),
  markoTypesFile: require.resolve("marko/index.d.ts"),
});

const fixtureRoot = path.resolve(__dirname, "fixtures/workspace");
const childFile = path.join(fixtureRoot, "tags/child.marko");
const consumerFile = path.join(fixtureRoot, "consumer.marko");

describe("marko-component-meta", () => {
  it("resolves tag files from an importer", () => {
    assert.equal(
      resolveTagFile(consumerFile, "child"),
      childFile.replace(/\\/g, "/"),
    );
  });
});
