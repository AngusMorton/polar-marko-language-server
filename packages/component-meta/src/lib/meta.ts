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

import { createSchemaResolvers } from "./schema";
import type {
  AttrTagMeta,
  BodyMeta,
  ContentMeta,
  Declaration,
  EventMeta,
  InputMeta,
  MetaCheckerOptions,
  ResultMeta,
  TagInputMeta,
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
  options: Required<Pick<MetaCheckerOptions, "noDeclarations" | "rawType">> &
    Pick<MetaCheckerOptions, "schema">;
  schema: ReturnType<typeof createSchemaResolvers>;
};

const defaultOptions = {
  schema: false,
  noDeclarations: false,
  rawType: false,
} satisfies MetadataContext["options"];

export function extractTagMeta(
  tsModule: typeof import("typescript"),
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  extracted: Extracted | undefined,
  options: MetaCheckerOptions = defaultOptions,
): TagMeta {
  const fileName = extracted
    ? normalizePath(extracted.parsed.filename)
    : normalizePath(sourceFile.fileName);
  const tagDef = findTagDefinitionForFile(fileName);
  const context = {
    ts: tsModule,
    checker,
    sourceFile,
    extracted,
    tagDef,
    options: {
      schema: options.schema ?? defaultOptions.schema,
      noDeclarations: options.noDeclarations ?? defaultOptions.noDeclarations,
      rawType: options.rawType ?? defaultOptions.rawType,
    },
  } as Omit<MetadataContext, "schema">;
  const schema = createSchemaResolvers({
    ts: tsModule,
    checker,
    sourceFile,
    options: context.options.schema ?? false,
    deprecatedOptions: context.options,
    getDeclarations: (declarations) =>
      getDeclarationRanges(
        declarations,
        context.extracted,
        context.sourceFile,
        false,
      ),
  });
  const fullContext: MetadataContext = {
    ...context,
    schema,
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
  const events: EventMeta[] = [];
  let content: ContentMeta | undefined;

  for (const property of inputType?.getProperties() ?? []) {
    const propertyType = checker.getTypeOfSymbolAtLocation(
      property,
      sourceFile,
    );

    if (isContentPropertyName(property.getName())) {
      const bodyMeta = extractBodyMeta(property, propertyType, fullContext);
      if (bodyMeta) {
        content = extractContentMeta(property, bodyMeta, fullContext);
        continue;
      }
    }

    const attrTagTarget = unwrapAttrTagType(tsModule, propertyType, checker);
    if (attrTagTarget) {
      const attrTag = extractAttrTagMeta(property, attrTagTarget, fullContext);
      attrTags.push(attrTag);
      continue;
    }

    const event = extractEventMeta(property, propertyType, fullContext);
    if (event) {
      events.push(event);
      continue;
    }

    inputs.push(extractInputMeta(property, propertyType, fullContext));
  }

  const input = inputSymbol
    ? extractInputTypeMeta(inputSymbol, inputType, fullContext, {
        props: inputs,
        attrTags,
        events,
        content,
      })
    : undefined;

  return {
    file: fileName,
    name: tagDef?.name ?? inferTagName(fileName),
    description:
      tagDef?.description ||
      getSymbolDocumentation(tsModule, moduleSymbol, checker) ||
      getSymbolDocumentation(tsModule, inputSymbol, checker),
    declarations: getTagDeclarations(inputSymbol, fileName, extracted),
    input,
    result: extractResultMeta(moduleSymbol, fullContext),
    inputs,
    events,
    attrTags,
    body: content,
  } satisfies TagMeta;
}

export function extractTagMetaFromProgram(
  tsModule: typeof import("typescript"),
  program: ts.Program,
  fileName: string,
  extracted?: Extracted,
  options?: MetaCheckerOptions,
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
    options,
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
    default: stringifyDefaultValue(taglibAttr?.defaultValue),
    global: false,
    required: !isOptionalSymbol(context.ts, symbol),
    tags: context.schema.getJsDocTags(symbol),
    schema: context.schema.resolveSchema(type),
    get declarations() {
      return context.options.noDeclarations ? [] : this.getDeclarations();
    },
    get rawType() {
      if (context.options.rawType) {
        return this.getTypeObject();
      }
    },
    getDeclarations() {
      return getDeclarations(symbol, context);
    },
    getTypeObject() {
      return type;
    },
    enumValues: getEnumValues(type, context.checker, taglibAttr?.enum),
  } satisfies InputMeta;
}

function extractInputTypeMeta(
  symbol: ts.Symbol,
  type: ts.Type | undefined,
  context: MetadataContext,
  input: Pick<TagInputMeta, "attrTags" | "content" | "events" | "props">,
): TagInputMeta {
  return {
    name: "Input",
    description: getSymbolDocumentation(context.ts, symbol, context.checker),
    type: type
      ? typeToString(context.ts, context.checker, type, context.sourceFile)
      : symbol.getName(),
    tags: context.schema.getJsDocTags(symbol),
    schema: type ? context.schema.resolveSchema(type) : symbol.getName(),
    source: getInputSource(symbol, context),
    props: input.props,
    attrTags: input.attrTags,
    events: input.events,
    content: input.content,
    get declarations() {
      return context.options.noDeclarations ? [] : this.getDeclarations();
    },
    get rawType() {
      if (context.options.rawType) {
        return this.getTypeObject();
      }
    },
    getDeclarations() {
      return getDeclarations(symbol, context);
    },
    getTypeObject() {
      return type;
    },
  } satisfies TagInputMeta;
}

function extractAttrTagMeta(
  symbol: ts.Symbol,
  targetType: ts.Type,
  context: MetadataContext,
  visited = new Set<ts.Type>(),
): AttrTagMeta {
  const props: InputMeta[] = [];
  const attrTags: AttrTagMeta[] = [];
  const events: EventMeta[] = [];
  let content: ContentMeta | undefined;
  const nestedVisited = new Set(visited).add(targetType);
  const nestedTag = context.tagDef?.nestedTags
    ? Object.values(context.tagDef.nestedTags).find(
        (tag) => tag.targetProperty === symbol.getName(),
      )
    : undefined;

  for (const property of targetType.getProperties()) {
    const propertyType = context.checker.getTypeOfSymbolAtLocation(
      property,
      context.sourceFile,
    );
    if (isContentPropertyName(property.getName())) {
      const bodyMeta = extractBodyMeta(property, propertyType, context);
      if (bodyMeta) {
        content = extractContentMeta(property, bodyMeta, context);
      }
      continue;
    }

    const attrTagTarget = unwrapAttrTagType(
      context.ts,
      propertyType,
      context.checker,
    );
    if (attrTagTarget) {
      if (!visited.has(attrTagTarget)) {
        attrTags.push(
          extractAttrTagMeta(property, attrTagTarget, context, nestedVisited),
        );
      }
      continue;
    }

    const event = extractEventMeta(property, propertyType, context);
    if (event) {
      events.push(event);
      continue;
    }

    props.push(extractInputMeta(property, propertyType, context));
  }

  return {
    name: nestedTag?.name ?? symbol.getName(),
    propertyName: symbol.getName(),
    description: getSymbolDocumentation(context.ts, symbol, context.checker),
    type: typeToString(
      context.ts,
      context.checker,
      targetType,
      context.sourceFile,
    ),
    global: false,
    required: !isOptionalSymbol(context.ts, symbol),
    tags: context.schema.getJsDocTags(symbol),
    schema: context.schema.resolveSchema(targetType),
    get declarations() {
      return context.options.noDeclarations ? [] : this.getDeclarations();
    },
    get rawType() {
      if (context.options.rawType) {
        return this.getTypeObject();
      }
    },
    getDeclarations() {
      return getDeclarations(symbol, context);
    },
    getTypeObject() {
      return targetType;
    },
    props,
    attrTags,
    events,
    content,
    inputs: props,
    body: content,
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
        tags: [],
        schema: context.schema.resolveSchema(bodyType.returnType),
        get declarations() {
          return context.options.noDeclarations ? [] : this.getDeclarations();
        },
        get rawType() {
          if (context.options.rawType) {
            return this.getTypeObject();
          }
        },
        getDeclarations() {
          return getDeclarations(symbol, context);
        },
        getTypeObject() {
          return bodyType.returnType;
        },
      } satisfies ValueMeta);

  return {
    description: getSymbolDocumentation(context.ts, symbol, context.checker),
    type: typeToString(context.ts, context.checker, type, context.sourceFile),
    tags: context.schema.getJsDocTags(symbol),
    schema: context.schema.resolveSchema(type),
    parameters,
    return: returnMeta,
    get declarations() {
      return context.options.noDeclarations ? [] : this.getDeclarations();
    },
    get rawType() {
      if (context.options.rawType) {
        return this.getTypeObject();
      }
    },
    getDeclarations() {
      return getDeclarations(symbol, context);
    },
    getTypeObject() {
      return type;
    },
  } satisfies BodyMeta;
}

function extractEventMeta(
  symbol: ts.Symbol,
  type: ts.Type,
  context: MetadataContext,
): EventMeta | undefined {
  const name = symbol.getName();
  if (!isEventInputName(name)) {
    return;
  }

  const eventType = getCallableType(type);
  const signature = eventType?.getCallSignatures()[0];
  if (!signature) {
    return;
  }

  return context.schema.resolveEvent(symbol, signature);
}

function getCallableType(type: ts.Type): ts.Type | undefined {
  if (type.getCallSignatures().length) {
    return type;
  }

  if (type.isUnion()) {
    return type.types.find((part) => part.getCallSignatures().length);
  }
}

function isContentPropertyName(name: string): name is "content" | "renderBody" {
  return name === "content" || name === "renderBody";
}

function isEventInputName(name: string) {
  return /^(?:on[A-Z]|on-|.+Change$)/.test(name);
}

function extractContentMeta(
  symbol: ts.Symbol,
  body: BodyMeta,
  context: MetadataContext,
): ContentMeta {
  const propertyName = symbol.getName();
  return {
    ...body,
    name: "content",
    propertyName: isContentPropertyName(propertyName)
      ? propertyName
      : "content",
    description: body.description,
    type: body.type,
    tags: body.tags,
    schema: body.schema,
    parameters: body.parameters,
    return: body.return,
    get declarations() {
      return body.declarations;
    },
    get rawType() {
      if (context.options.rawType) {
        return this.getTypeObject();
      }
    },
    getDeclarations() {
      return body.getDeclarations();
    },
    getTypeObject() {
      return context.checker.getTypeOfSymbolAtLocation(
        symbol,
        context.sourceFile,
      );
    },
  } satisfies ContentMeta;
}

function extractResultMeta(
  moduleSymbol: ts.Symbol | undefined,
  context: MetadataContext,
): ResultMeta | undefined {
  const defaultSymbol = moduleSymbol
    ? context.checker
        .getExportsOfModule(moduleSymbol)
        .find((symbol) => symbol.getName() === "default")
    : undefined;
  const defaultType = defaultSymbol
    ? context.checker.getTypeOfSymbolAtLocation(
        defaultSymbol,
        context.sourceFile,
      )
    : undefined;
  const templateMethod = defaultType?.getProperty("_");
  const templateMethodType = templateMethod
    ? context.checker.getTypeOfSymbolAtLocation(
        templateMethod,
        context.sourceFile,
      )
    : undefined;
  const resultType = getTemplateResultType(templateMethodType, context);

  if (!resultType || isVoidLike(resultType)) {
    return;
  }

  return {
    name: "result",
    description: "",
    type: typeToString(
      context.ts,
      context.checker,
      resultType,
      context.sourceFile,
    ),
    tags: [],
    schema: context.schema.resolveSchema(resultType),
    get declarations() {
      return context.options.noDeclarations ? [] : this.getDeclarations();
    },
    get rawType() {
      if (context.options.rawType) {
        return this.getTypeObject();
      }
    },
    getDeclarations() {
      return [];
    },
    getTypeObject() {
      return resultType;
    },
  } satisfies ResultMeta;
}

function getTemplateResultType(
  templateMethodType: ts.Type | undefined,
  context: MetadataContext,
) {
  let type = templateMethodType;
  for (let i = 0; type && i < 3; i++) {
    if (type.isUnion()) {
      type = type.types.find((part) => part.getCallSignatures().length);
    }
    if (!type) {
      break;
    }

    const signature = type.getCallSignatures()[0];
    if (!signature) {
      break;
    }

    type = signature.getReturnType();
  }

  return type && unwrapReturnWithScope(type, context);
}

function unwrapReturnWithScope(type: ts.Type, context: MetadataContext) {
  if (type.aliasSymbol?.getName() === "ReturnWithScope") {
    return type.aliasTypeArguments?.[1];
  }

  const returnProperty = type.getProperty("return");
  if (returnProperty) {
    return context.checker.getTypeOfSymbolAtLocation(
      returnProperty,
      context.sourceFile,
    );
  }
}

function getBodyParameters(paramsType: ts.Type, context: MetadataContext) {
  const tuple = asTupleType(context.ts, paramsType);
  if (!tuple) {
    return [];
  }

  const typeArguments = context.checker.getTypeArguments(tuple);
  const labels = tuple.target.labeledElementDeclarations;

  return typeArguments.map((type, index) => {
    const label = labels?.[index]?.name.getText();
    return {
      name: label,
      description: "",
      type: typeToString(context.ts, context.checker, type, context.sourceFile),
      tags: [],
      schema: context.schema.resolveSchema(type),
      declarations: [],
      getDeclarations() {
        return [];
      },
      getTypeObject() {
        return type;
      },
    } satisfies ValueMeta;
  });
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
  const declarations = getDeclarationRanges(
    symbol.declarations ?? [],
    context.extracted,
    context.sourceFile,
    true,
  );
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

function getDeclarationRanges(
  declarations: readonly ts.Declaration[],
  extracted: Extracted | undefined,
  sourceFile: ts.SourceFile,
  fallback = false,
) {
  const ranges = declarations
    .map((declaration) => mapDeclaration(declaration, extracted))
    .filter((declaration): declaration is Declaration => !!declaration);
  if (ranges.length || !fallback) {
    return ranges;
  }

  return [
    {
      file: normalizePath(extracted?.parsed.filename ?? sourceFile.fileName),
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
    return (
      type.aliasTypeArguments?.[0] ??
      findAttrTagTargetFromIntersection(tsModule, type, checker)
    );
  }

  const reference = findNamedType(tsModule, type, checker, "AttrTag");
  return (
    (reference && checker.getTypeArguments(reference)[0]) ??
    findAttrTagTargetFromIntersection(tsModule, type, checker)
  );
}

function findAttrTagTargetFromIntersection(
  tsModule: typeof import("typescript"),
  type: ts.Type,
  checker: ts.TypeChecker,
) {
  if (!type.isIntersection()) {
    return;
  }

  return type.types.find(
    (part) => !isIterableAttrTagPart(tsModule, part, checker),
  );
}

function isIterableAttrTagPart(
  _tsModule: typeof import("typescript"),
  type: ts.Type,
  checker: ts.TypeChecker,
) {
  return type.getProperties().some((property) => {
    const name = property.getName();
    return (
      name === "__@iterator" ||
      checker.symbolToString(property) === "[Symbol.iterator]"
    );
  });
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

function stringifyDefaultValue(value: unknown) {
  if (value === undefined) {
    return;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
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
      safeTypeToString(checker, part, context),
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

  return safeTypeToString(checker, type, context);
}

function safeTypeToString(
  checker: ts.TypeChecker,
  type: ts.Type,
  context: ts.Node,
) {
  try {
    return checker.typeToString(type, context, TYPE_FORMAT_FLAGS);
  } catch (error) {
    if (error instanceof RangeError) {
      return type.getSymbol()?.getName() || "unknown";
    }

    throw error;
  }
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
