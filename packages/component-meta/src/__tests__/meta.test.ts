import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { Project } from "@marko/language-tools";

import { createChecker, resolveTagFile } from "..";

Project.setDefaultTypePaths({
  internalTypesFile:
    require.resolve("@marko/language-tools/marko.internal.d.ts"),
  markoTypesFile: require.resolve("marko/index.d.ts"),
});

const fixtureRoot = path.resolve(__dirname, "fixtures/workspace");
const childFile = path.join(fixtureRoot, "tags/child.marko");
const consumerFile = path.join(fixtureRoot, "consumer.marko");
const fancyButtonFile = path.join(
  fixtureRoot,
  "components/fancy-button/index.marko",
);
const targetListFile = path.join(
  fixtureRoot,
  "components/target-list/index.marko",
);
const tsconfig = path.join(fixtureRoot, "tsconfig.json");

describe("marko-component-meta", () => {
  it("resolves tag files from an importer", () => {
    assert.equal(
      resolveTagFile(consumerFile, "child"),
      childFile.replace(/\\/g, "/"),
    );
  });

  it("extracts Marko input metadata", () => {
    const checker = createChecker(tsconfig, { schema: true });
    const meta = checker.getComponentMeta(fancyButtonFile);

    assert.equal(meta.name, "fancy-button");
    assert.equal(meta.description, "Fancy button tag.");
    assert.equal(meta.input?.name, "Input");
    assert.deepEqual(
      meta.input?.props.map((prop) => prop.name),
      ["message", "theme", "options", "firstShared", "secondShared"],
    );
    assert.deepEqual(meta.inputs, meta.input?.props);

    const theme = meta.input?.props.find((prop) => prop.name === "theme");
    assert.equal(theme?.description, "Supported themes.");
    assert.equal(theme?.required, false);
    assert.deepEqual(theme?.enumValues, ["primary", "secondary"]);
    assert.deepEqual(theme?.schema, {
      kind: "enum",
      type: '"primary" | "secondary" | undefined',
      schema: ["undefined", '"primary"', '"secondary"'],
    });
    assert.ok(theme?.getDeclarations()[0]?.file.endsWith("index.marko"));

    const options = meta.input?.props.find((prop) => prop.name === "options");
    assert.equal(options?.schema && typeof options.schema, "object");
    assert.equal(
      typeof options?.schema === "object" && options.schema.kind,
      "object",
    );
    const optionProperties =
      typeof options?.schema === "object" && options.schema.kind === "object"
        ? options.schema.schema
        : undefined;
    const childSchema = optionProperties?.child?.schema;
    assert.equal(typeof childSchema === "object" && childSchema.kind, "enum");
    const recursiveBranch =
      typeof childSchema === "object" && childSchema.kind === "enum"
        ? childSchema.schema?.find((schema) => schema !== "undefined")
        : undefined;
    assert.equal(typeof recursiveBranch, "string");

    const firstShared = meta.input?.props.find(
      (prop) => prop.name === "firstShared",
    );
    const secondShared = meta.input?.props.find(
      (prop) => prop.name === "secondShared",
    );
    assert.equal(
      typeof firstShared?.schema === "object" && firstShared.schema.kind,
      "object",
    );
    assert.equal(
      typeof secondShared?.schema === "object" && secondShared.schema.kind,
      "object",
    );
    assert.deepEqual(
      typeof firstShared?.schema === "object" &&
        firstShared.schema.kind === "object" &&
        Object.keys(firstShared.schema.schema ?? {}),
      ["value"],
    );
    assert.deepEqual(
      typeof secondShared?.schema === "object" &&
        secondShared.schema.kind === "object" &&
        Object.keys(secondShared.schema.schema ?? {}),
      ["value"],
    );

    assert.deepEqual(
      meta.input?.events.map((event) => event.name),
      ["onPress", "valueChange"],
    );

    const onPress = meta.input?.events.find(
      (event) => event.name === "onPress",
    );
    assert.equal(onPress?.description, "Optional click hook.");
    assert.equal(onPress?.type, "[]");
    assert.equal(onPress?.signature, "(): void");
    assert.equal(onPress?.required, false);

    assert.equal(meta.input?.content?.name, "content");
    assert.equal(meta.input?.content?.propertyName, "content");
    assert.equal(
      meta.input?.content?.parameters[0]?.type,
      "{ pressed: boolean; }",
    );

    assert.equal(meta.result?.name, "result");
    assert.equal(meta.result?.type, "{ value: { pressed: boolean; }; }");
  });

  it("extracts attr tags with content", () => {
    const checker = createChecker(tsconfig, { schema: true });
    const meta = checker.getTagMetaForTag(consumerFile, "child");

    const row = meta?.input?.attrTags[0];
    assert.equal(row?.name, "row");
    assert.equal(row?.props[0]?.name, "enabled");
    assert.equal(row?.content?.name, "content");
    assert.equal(row?.content?.parameters[0]?.type, "{ id: string; }");
    assert.deepEqual(meta?.attrTags, meta?.input?.attrTags);
    assert.deepEqual(row?.inputs, row?.props);
  });

  it("maps attr tag target properties to public nested tag names", () => {
    const checker = createChecker(tsconfig, { schema: true });
    const meta = checker.getComponentMeta(targetListFile);

    const item = meta.input?.attrTags[0];
    assert.equal(item?.name, "item");
    assert.equal(item?.propertyName, "items");
    assert.equal(item?.props[0]?.name, "x");
  });

  it("updates files and clears cached metadata", () => {
    const checker = createChecker(tsconfig);
    const meta = checker.getTagMeta(fancyButtonFile);
    const source = fs.readFileSync(fancyButtonFile, "utf-8");

    assert.equal(
      meta.input?.props.some((prop) => prop.name === "added"),
      false,
    );

    checker.updateFile(
      fancyButtonFile,
      source.replace("message: T;", "message: T;\n  added: string;"),
    );

    assert.equal(
      checker
        .getTagMeta(fancyButtonFile)
        .input?.props.some((prop) => prop.name === "added"),
      true,
    );
  });
});
