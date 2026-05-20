import type { TagDefinition } from "@marko/compiler/babel-utils";
import {
  type Extracted,
  extractScript,
  parse,
  Project,
  ScriptLang,
} from "@marko/language-tools";
import path from "path";
import type ts from "typescript";

import type {
  AttrTagMeta,
  BodyMeta,
  Declaration,
  InputMeta,
  InputTypeMeta,
  TagMeta,
  ValueMeta,
} from "./types";

const TYPE_FORMAT_FLAGS = 536870912 as ts.TypeFormatFlags;

type MetadataContext = {
  ts: typeof import("typescript");
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  extracted?: Extracted;
  tagDef?: TagDefinition;
};

export function extractTagMeta(
  tsModule: typeof import("typescript"),
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  extracted: Extracted | undefined,
): TagMeta {
  const fileName = extracted
    ? normalizePath(extracted.parsed.filename)
    : normalizePath(sourceFile.fileName);
  const tagDef = findTagDefinitionForFile(fileName);
  const context: MetadataContext = {
    ts: tsModule,
    checker,
    sourceFile,
    extracted,
    tagDef,
  };

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  const inputSymbol =
    moduleSymbol &&
    checker
      .getExportsOfModule(moduleSymbol)
      .find((symbol) => symbol.getName() === "Input");
  const inputType = inputSymbol
    ? checker.getDeclaredTypeOfSymbol(inputSymbol)
    : undefined;

  const inputs: InputMeta[] = [];
  const attrTags: AttrTagMeta[] = [];
  let body: BodyMeta | undefined;

  for (const property of inputType?.getProperties() ?? []) {
    const propertyType = checker.getTypeOfSymbolAtLocation(
      property,
      sourceFile,
    );

    if (property.getName() === "renderBody") {
      const bodyMeta = extractBodyMeta(property, propertyType, context);
      if (bodyMeta) {
        body = bodyMeta;
        continue;
      }
    }

    const attrTagTarget = unwrapAttrTagType(tsModule, propertyType, checker);
    if (attrTagTarget) {
      attrTags.push(extractAttrTagMeta(property, attrTagTarget, context));
      continue;
    }

    inputs.push(extractInputMeta(property, propertyType, context));
  }

  return {
    file: fileName,
    name: tagDef?.name ?? inferTagName(fileName),
    description:
      tagDef?.description ||
      getSymbolDocumentation(tsModule, moduleSymbol, checker) ||
      getSymbolDocumentation(tsModule, inputSymbol, checker),
    declarations: getTagDeclarations(inputSymbol, fileName, extracted),
    input: inputSymbol
      ? extractInputTypeMeta(inputSymbol, inputType, context)
      : undefined,
    inputs,
    attrTags,
    body,
  } satisfies TagMeta;
}

export function extractTagMetaFromProgram(
  tsModule: typeof import("typescript"),
  program: ts.Program,
  fileName: string,
  extracted?: Extracted,
) {
  fileName = normalizePath(fileName);
  const virtualFileName = toVirtualFileName(fileName, program);
  const sourceFile = fileName.endsWith(".marko")
    ? (program.getSourceFile(virtualFileName) ??
      program.getSourceFile(fileName))
    : (program.getSourceFile(fileName) ??
      program.getSourceFile(virtualFileName));

  if (!sourceFile) {
    return;
  }

  extracted ??= extractScriptFromProgramSource(tsModule, program, fileName);

  return extractTagMeta(
    tsModule,
    program.getTypeChecker(),
    sourceFile,
    extracted,
  );
}

export function getVisibleTagNames(importerFileName: string) {
  return Project.getTagLookup(path.dirname(importerFileName))
    .getTagsSorted()
    .filter((tag) => !shouldSkipTag(tag))
    .map((tag) => tag.name);
}

export function resolveTagFile(importerFileName: string, tagName: string) {
  const tagDef = Project.getTagLookup(path.dirname(importerFileName)).getTag(
    tagName,
  );
  if (!tagDef || shouldSkipTag(tagDef)) {
    return;
  }

  const fileName = tagDef.template || tagDef.renderer;
  return fileName ? normalizePath(fileName) : undefined;
}

function extractInputMeta(
  symbol: ts.Symbol,
  type: ts.Type,
  context: MetadataContext,
): InputMeta {
  const taglibAttr =
    context.tagDef && context.checker.getSymbolAtLocation(context.sourceFile)
      ? Project.getTagLookup(
          path.dirname(context.sourceFile.fileName),
        ).getAttribute(context.tagDef.name, symbol.getName())
      : undefined;

  return {
    name: symbol.getName(),
    description:
      getSymbolDocumentation(context.ts, symbol, context.checker) ||
      taglibAttr?.description ||
      "",
    type: typeToString(context.ts, context.checker, type, context.sourceFile),
    required: !isOptionalSymbol(context.ts, symbol),
    declarations: getDeclarations(symbol, context),
    enumValues: getEnumValues(type, context.checker, taglibAttr?.enum),
  } satisfies InputMeta;
}

function extractInputTypeMeta(
  symbol: ts.Symbol,
  type: ts.Type | undefined,
  context: MetadataContext,
): InputTypeMeta {
  return {
    name: "Input",
    description: getSymbolDocumentation(context.ts, symbol, context.checker),
    type: type
      ? typeToString(context.ts, context.checker, type, context.sourceFile)
      : symbol.getName(),
    source: getInputSource(symbol, context),
    declarations: getDeclarations(symbol, context),
  } satisfies InputTypeMeta;
}

function extractAttrTagMeta(
  symbol: ts.Symbol,
  targetType: ts.Type,
  context: MetadataContext,
): AttrTagMeta {
  const inputs: InputMeta[] = [];
  let body: BodyMeta | undefined;

  for (const property of targetType.getProperties()) {
    const propertyType = context.checker.getTypeOfSymbolAtLocation(
      property,
      context.sourceFile,
    );
    if (property.getName() === "renderBody") {
      body = extractBodyMeta(property, propertyType, context);
      continue;
    }
    inputs.push(extractInputMeta(property, propertyType, context));
  }

  return {
    name: symbol.getName(),
    description: getSymbolDocumentation(context.ts, symbol, context.checker),
    type: typeToString(
      context.ts,
      context.checker,
      targetType,
      context.sourceFile,
    ),
    required: !isOptionalSymbol(context.ts, symbol),
    declarations: getDeclarations(symbol, context),
    inputs,
    body,
  } satisfies AttrTagMeta;
}

function extractBodyMeta(
  symbol: ts.Symbol,
  type: ts.Type,
  context: MetadataContext,
): BodyMeta | undefined {
  const bodyType = unwrapBodyType(context.ts, type, context.checker);
  if (!bodyType) {
    return;
  }

  const parameters = getBodyParameters(bodyType.params, context);
  const returnMeta = isVoidLike(bodyType.returnType)
    ? undefined
    : ({
        description: "",
        type: typeToString(
          context.ts,
          context.checker,
          bodyType.returnType,
          context.sourceFile,
        ),
        declarations: getDeclarations(symbol, context),
      } satisfies ValueMeta);

  return {
    description: getSymbolDocumentation(context.ts, symbol, context.checker),
    type: typeToString(context.ts, context.checker, type, context.sourceFile),
    parameters,
    return: returnMeta,
  } satisfies BodyMeta;
}

function getBodyParameters(paramsType: ts.Type, context: MetadataContext) {
  const tuple = asTupleType(context.ts, paramsType);
  if (!tuple) {
    return [];
  }

  const typeArguments = context.checker.getTypeArguments(tuple);
  const labels = tuple.target.labeledElementDeclarations;

  return typeArguments.map((type, index) => ({
    name: labels?.[index]?.name.getText(),
    description: "",
    type: typeToString(context.ts, context.checker, type, context.sourceFile),
    declarations: [],
  })) satisfies ValueMeta[];
}

function getTagDeclarations(
  inputSymbol: ts.Symbol | undefined,
  fileName: string,
  extracted: Extracted | undefined,
) {
  if (inputSymbol?.declarations?.length) {
    const mapped = mapDeclaration(inputSymbol.declarations[0]!, extracted);
    if (mapped) {
      return [mapped];
    }
  }

  return [
    { file: fileName, range: [0, 0] as [number, number] },
  ] satisfies Declaration[];
}

function getDeclarations(symbol: ts.Symbol, context: MetadataContext) {
  const declarations = symbol.declarations
    ?.map((declaration) => mapDeclaration(declaration, context.extracted))
    .filter((declaration): declaration is Declaration => !!declaration);
  return declarations?.length
    ? declarations
    : [
        {
          file:
            context.extracted?.parsed.filename ?? context.sourceFile.fileName,
          range: [0, 0] as [number, number],
        },
      ];
}

function getInputSource(symbol: ts.Symbol, context: MetadataContext) {
  const declaration = symbol.declarations?.find(
    (declaration) =>
      context.ts.isInterfaceDeclaration(declaration) ||
      context.ts.isTypeAliasDeclaration(declaration),
  );
  if (!declaration) {
    return;
  }

  const sourceFile = declaration.getSourceFile();
  const start = declaration.getStart(sourceFile);
  const declarationText = declaration.getText(sourceFile);

  const extracted = context.extracted;
  if (extracted) {
    const mappedRange = extracted.sourceRangeAt(start, declaration.end);
    if (mappedRange) {
      const mappedText = extracted.parsed.code.slice(
        mappedRange.start,
        mappedRange.end,
      );
      return /^(?:export\s+)?(?:interface|type)\s+Input\b/.test(mappedText)
        ? mappedText
        : declarationText;
    }
  }

  return declarationText;
}

function mapDeclaration(
  declaration: ts.Declaration,
  extracted: Extracted | undefined,
): Declaration | undefined {
  const declarationSourceFile = declaration.getSourceFile();
  const declarationFile = normalizePath(declarationSourceFile.fileName).replace(
    /\.marko\.(?:[cm]?tsx?|[cm]?jsx?)$/,
    ".marko",
  );
  const file =
    extracted && normalizePath(extracted.parsed.filename) === declarationFile
      ? normalizePath(extracted.parsed.filename)
      : declarationFile;
  const start = declaration.getStart();
  const end = declaration.getEnd();

  if (extracted && normalizePath(extracted.parsed.filename) === file) {
    const sourceRange = extracted.sourceRangeAt(start, end);
    if (sourceRange) {
      return { file, range: [sourceRange.start, sourceRange.end] };
    }
  }

  return { file, range: [start, end] };
}

function unwrapAttrTagType(
  tsModule: typeof import("typescript"),
  type: ts.Type,
  checker: ts.TypeChecker,
): ts.Type | undefined {
  if (type.isUnion()) {
    for (const part of type.types) {
      const unwrapped: ts.Type | undefined = unwrapAttrTagType(
        tsModule,
        part,
        checker,
      );
      if (unwrapped) {
        return unwrapped;
      }
    }
    return;
  }

  if (type.aliasSymbol?.getName() === "AttrTag") {
    return type.aliasTypeArguments?.[0];
  }

  const reference = findNamedType(tsModule, type, checker, "AttrTag");
  return reference && checker.getTypeArguments(reference)[0];
}

function unwrapBodyType(
  tsModule: typeof import("typescript"),
  type: ts.Type,
  checker: ts.TypeChecker,
): { params: ts.Type; returnType: ts.Type } | undefined {
  if (type.isUnion()) {
    for (const part of type.types) {
      const unwrapped: { params: ts.Type; returnType: ts.Type } | undefined =
        unwrapBodyType(tsModule, part, checker);
      if (unwrapped) {
        return unwrapped;
      }
    }
    return;
  }

  if (type.aliasSymbol?.getName() === "Body") {
    const [params, returnType] = type.aliasTypeArguments ?? [];
    return params && returnType ? { params, returnType } : undefined;
  }

  const reference = findNamedType(tsModule, type, checker, "Body");
  if (!reference) {
    return;
  }

  const [params, returnType] = checker.getTypeArguments(reference);
  return params && returnType ? { params, returnType } : undefined;
}

function findNamedType(
  tsModule: typeof import("typescript"),
  type: ts.Type,
  checker: ts.TypeChecker,
  name: string,
): ts.TypeReference | undefined {
  if (matchesTypeName(checker, type, name) && isTypeReference(tsModule, type)) {
    return type;
  }

  if (type.isIntersection()) {
    for (const part of type.types) {
      const found = findNamedType(tsModule, part, checker, name);
      if (found) {
        return found;
      }
    }
  }
}

function matchesTypeName(checker: ts.TypeChecker, type: ts.Type, name: string) {
  for (const symbol of [type.aliasSymbol, type.getSymbol()]) {
    if (!symbol) continue;
    if (symbol.getName() !== name) continue;
    const fullName = checker.getFullyQualifiedName(symbol);
    if (
      fullName === `Marko.${name}` ||
      fullName.endsWith(`.${name}`) ||
      symbol.getName() === name
    ) {
      return true;
    }
  }

  return false;
}

function isTypeReference(
  tsModule: typeof import("typescript"),
  type: ts.Type,
): type is ts.TypeReference {
  return (
    !!(type.flags & tsModule.TypeFlags.Object) &&
    !!((type as ts.ObjectType).objectFlags & tsModule.ObjectFlags.Reference)
  );
}

function asTupleType(
  tsModule: typeof import("typescript"),
  type: ts.Type,
): ts.TupleTypeReference | undefined {
  if (!isTypeReference(tsModule, type)) {
    return;
  }

  const target = type.target as ts.GenericType | undefined;
  if (target && target.objectFlags & tsModule.ObjectFlags.Tuple) {
    return type as ts.TupleTypeReference;
  }
}

function getEnumValues(
  type: ts.Type,
  checker: ts.TypeChecker,
  fallback: string[] | undefined,
) {
  const literalValues = type.isUnion()
    ? type.types
        .map((part) => getLiteralValue(part, checker))
        .filter((value): value is string => value !== undefined)
    : [];

  if (literalValues.length) {
    return literalValues;
  }

  return fallback?.length ? [...fallback] : undefined;
}

function getLiteralValue(type: ts.Type, checker: ts.TypeChecker) {
  if (type.isStringLiteral()) {
    return type.value;
  }

  if (type.isNumberLiteral()) {
    return String(type.value);
  }

  const text = checker.typeToString(type);
  return /^".*"$/.test(text) ? text.slice(1, -1) : undefined;
}

function typeToString(
  _ts: typeof import("typescript"),
  checker: ts.TypeChecker,
  type: ts.Type,
  context: ts.Node,
) {
  const simplified = stripOptionalUndefined(type);
  if (simplified) {
    const parts = simplified.map((part) =>
      checker.typeToString(part, context, TYPE_FORMAT_FLAGS),
    );
    if (
      parts.length === 2 &&
      parts.includes("true") &&
      parts.includes("false")
    ) {
      return "boolean";
    }
    return parts.join(" | ");
  }

  return checker.typeToString(type, context, TYPE_FORMAT_FLAGS);
}

function stripOptionalUndefined(type: ts.Type) {
  if (!type.isUnion()) {
    return undefined;
  }

  const filtered = type.types.filter((part) => (part.flags & 4) === 0);
  return filtered.length !== type.types.length ? filtered : undefined;
}

function getSymbolDocumentation(
  tsModule: typeof import("typescript"),
  symbol: ts.Symbol | undefined,
  checker: ts.TypeChecker,
) {
  return symbol
    ? tsModule.displayPartsToString(symbol.getDocumentationComment(checker))
    : "";
}

function isOptionalSymbol(
  tsModule: typeof import("typescript"),
  symbol: ts.Symbol,
) {
  return !!(symbol.flags & tsModule.SymbolFlags.Optional);
}

function isVoidLike(type: ts.Type) {
  return (type.flags & 16384) !== 0 || (type.flags & 32768) !== 0;
}

function findTagDefinitionForFile(fileName: string) {
  const lookup = Project.getTagLookup(path.dirname(fileName));
  return lookup.getTagsSorted().find((tag) => {
    const tagFile = tag.template || tag.renderer;
    return tagFile && normalizePath(tagFile) === fileName;
  });
}

function inferTagName(fileName: string) {
  fileName = fileName.replace(/\.marko\.(?:[cm]?tsx?|[cm]?jsx?)$/, ".marko");
  const base = path.basename(fileName);
  if (/^index(?:\.d)?\.marko$/.test(base)) {
    return path.basename(path.dirname(fileName));
  }

  return base.replace(/(?:\.d)?\.marko$/, "");
}

function extractScriptFromProgramSource(
  tsModule: typeof import("typescript"),
  program: ts.Program,
  fileName: string,
) {
  if (!fileName.endsWith(".marko")) {
    return;
  }

  const sourceText = program.getSourceFile(fileName)?.text;
  if (sourceText === undefined) {
    return;
  }

  const parsed = parse(sourceText, fileName);
  const dirname = path.dirname(fileName);
  const scriptLang = Project.getScriptLang(
    fileName,
    ScriptLang.ts,
    tsModule,
    tsModule.sys,
  );

  return extractScript({
    parsed,
    scriptLang,
    lookup: Project.getTagLookup(dirname),
    ts: tsModule,
    translator: Project.getConfig(dirname).translator,
  });
}

function toVirtualFileName(fileName: string, program: ts.Program) {
  if (!fileName.endsWith(".marko")) {
    return fileName;
  }

  for (const extension of [".ts", ".js", ".mts", ".mjs", ".cts", ".cjs"]) {
    const virtualFileName = `${fileName}${extension}`;
    if (program.getSourceFile(virtualFileName)) {
      return virtualFileName;
    }
  }

  return `${fileName}.ts`;
}

function shouldSkipTag(tag: TagDefinition) {
  return (
    tag.html ||
    tag.name === "*" ||
    tag.isNestedTag ||
    tag.parseOptions?.statement ||
    (tag.name[0] === "_" &&
      /^@?marko[/-]|[\\/]node_modules[\\/]/.test(tag.filePath))
  );
}

function normalizePath(fileName: string) {
  return fileName.replace(/\\/g, "/");
}
