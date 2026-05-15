import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Project } from "@marko/language-tools";

import { createChecker, createCheckerByJson } from "..";

Project.setDefaultTypePaths({
  internalTypesFile:
    require.resolve("@marko/language-tools/marko.internal.d.ts"),
  markoTypesFile: require.resolve("marko/index.d.ts"),
});

const fixtureRoot = path.resolve(__dirname, "fixtures/workspace");
const tsconfig = path.join(fixtureRoot, "tsconfig.json");
const fancyButtonFile = path.join(
  fixtureRoot,
  "components/fancy-button/index.marko",
);
const childFile = path.join(fixtureRoot, "tags/child.marko");
const consumerFile = path.join(fixtureRoot, "consumer.marko");

describe("marko-component-meta", () => {
  it("extracts top-level inputs and body metadata from a tag file", () => {
    const checker = createChecker(tsconfig);
    const meta = checker.getTagMeta(fancyButtonFile);

    assert.equal(meta.name, "fancy-button");
    assert.equal(meta.description, "Fancy button tag.");
    assert.deepEqual(
      meta.inputs.map((input) => ({
        name: input.name,
        required: input.required,
        type: input.type,
        enumValues: input.enumValues,
      })),
      [
        {
          name: "message",
          required: true,
          type: "T",
          enumValues: undefined,
        },
        {
          name: "theme",
          required: false,
          type: '"primary" | "secondary"',
          enumValues: ["primary", "secondary"],
        },
        {
          name: "onPress",
          required: false,
          type: "() => void",
          enumValues: undefined,
        },
      ],
    );
    assert.equal(meta.body?.parameters[0]?.name, "state");
    assert.equal(meta.body?.parameters[0]?.type, "{ pressed: boolean; }");
  });

  it("extracts attr tags and nested body metadata", () => {
    const checker = createChecker(tsconfig);
    const meta = checker.getTagMeta(childFile);

    assert.deepEqual(
      meta.inputs.map((input) => input.name),
      ["value", "valueChange"],
    );
    assert.equal(meta.attrTags.length, 1);
    assert.equal(meta.attrTags[0]?.name, "row");
    assert.deepEqual(
      meta.attrTags[0]?.inputs.map((input) => ({
        name: input.name,
        type: input.type,
        required: input.required,
      })),
      [{ name: "enabled", type: "boolean", required: false }],
    );
    assert.equal(meta.attrTags[0]?.body?.parameters[0]?.name, "data");
    assert.equal(
      meta.attrTags[0]?.body?.parameters[0]?.type,
      "{ id: string; }",
    );
  });

  it("resolves visible tag names and file-backed tag metadata from an importer", () => {
    const checker = createChecker(tsconfig);
    const names = checker.getTagNames(consumerFile);
    assert.ok(names.includes("child"));
    assert.ok(names.includes("fancy-button"));

    const meta = checker.getTagMetaForTag(consumerFile, "child");
    assert.equal(meta?.file, normalizePath(childFile));
    assert.equal(meta?.inputs[0]?.name, "value");
  });

  it("maps declarations back to source marko ranges", () => {
    const checker = createChecker(tsconfig);
    const meta = checker.getTagMeta(childFile);
    const declaration = meta.inputs[0]?.declarations[0];
    assert.ok(declaration);
    assert.equal(declaration.file, normalizePath(childFile));
    const source = fs.readFileSync(childFile, "utf8");
    assert.match(
      source.slice(declaration.range[0], declaration.range[1]),
      /value:\s*number \| string/,
    );
  });

  it("supports in-memory updates", () => {
    const checker = createChecker(tsconfig);
    checker.updateFile(
      childFile,
      [
        "/** Child tag. */",
        "export interface Input {",
        "  value: number | string;",
        "  extra?: string;",
        "}",
        "",
      ].join("\n"),
    );

    const meta = checker.getTagMeta(childFile);
    assert.deepEqual(
      meta.inputs.map((input) => input.name),
      ["value", "extra"],
    );
  });

  it("supports createCheckerByJson", () => {
    const checker = createCheckerByJson(fixtureRoot, {
      include: ["**/*"],
      compilerOptions: {
        module: "NodeNext",
        moduleResolution: "NodeNext",
        target: "ESNext",
        strict: true,
        skipLibCheck: true,
        allowNonTsExtensions: true,
      },
    });

    const meta = checker.getTagMeta(fancyButtonFile);
    assert.equal(meta.name, "fancy-button");
    assert.equal(meta.body?.parameters[0]?.name, "state");
  });
});

function normalizePath(fileName: string) {
  return fileName.replace(/\\/g, "/");
}
