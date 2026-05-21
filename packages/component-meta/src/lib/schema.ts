import type ts from "typescript";

import type {
  Declaration,
  EventMeta,
  JsDocTagMeta,
  MetaCheckerSchemaOptions,
  PropertyMeta,
  PropertyMetaSchema,
} from "./types";

export type SchemaContext = {
  ts: typeof import("typescript");
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  options: MetaCheckerSchemaOptions;
  deprecatedOptions: { noDeclarations: boolean; rawType: boolean };
  getDeclarations(declarations: readonly ts.Declaration[]): Declaration[];
};

export function createSchemaResolvers(context: SchemaContext) {
  function shouldIgnore(type: ts.Type, visited: Set<ts.Type>) {
    const name = typeToString(type);
    if (name === "any" || visited.has(type) || context.options === false) {
      return true;
    }

    if (typeof context.options === "object") {
      for (const ignore of context.options.ignore ?? []) {
        if (typeof ignore === "function") {
          const result = ignore(name, type, context.checker);
          if (typeof result === "boolean") {
            return result;
          }
        } else if (name === ignore) {
          return true;
        }
      }
    }

    return false;
  }

  function getJsDocTags(target: ts.Signature | ts.Symbol): JsDocTagMeta[] {
    return target.getJsDocTags(context.checker).map((tag) => ({
      name: tag.name,
      text:
        tag.text === undefined
          ? undefined
          : context.ts.displayPartsToString(tag.text),
    }));
  }

  function resolveProperty(
    symbol: ts.Symbol,
    type = context.checker.getTypeOfSymbolAtLocation(
      symbol,
      context.sourceFile,
    ),
    overrides: Partial<
      Pick<PropertyMeta, "default" | "description" | "global" | "required">
    > = {},
    schemaVisited?: Set<ts.Type>,
  ): PropertyMeta {
    let declarations: Declaration[] | undefined;
    let schema: PropertyMetaSchema | undefined;

    return {
      name: symbol.getName(),
      description:
        overrides.description ??
        context.ts.displayPartsToString(
          symbol.getDocumentationComment(context.checker),
        ),
      type: typeToString(type),
      default: overrides.default,
      global: overrides.global ?? false,
      required:
        overrides.required ?? !(symbol.flags & context.ts.SymbolFlags.Optional),
      tags: getJsDocTags(symbol),
      get schema() {
        return (schema ??= resolveSchema(type, schemaVisited));
      },
      get declarations() {
        return context.deprecatedOptions.noDeclarations
          ? []
          : this.getDeclarations();
      },
      get rawType() {
        if (context.deprecatedOptions.rawType) {
          return this.getTypeObject();
        }
      },
      getDeclarations() {
        return (declarations ??= context.getDeclarations(
          symbol.declarations ?? [],
        ));
      },
      getTypeObject() {
        return type;
      },
    } satisfies PropertyMeta;
  }

  function resolveValue(
    symbol: ts.Symbol,
    type = context.checker.getTypeOfSymbolAtLocation(
      symbol,
      context.sourceFile,
    ),
    name = symbol.getName(),
  ) {
    let declarations: Declaration[] | undefined;
    let schema: PropertyMetaSchema | undefined;

    return {
      name,
      description: context.ts.displayPartsToString(
        symbol.getDocumentationComment(context.checker),
      ),
      type: typeToString(type),
      tags: getJsDocTags(symbol),
      get schema() {
        return (schema ??= resolveSchema(type));
      },
      get declarations() {
        return context.deprecatedOptions.noDeclarations
          ? []
          : this.getDeclarations();
      },
      get rawType() {
        if (context.deprecatedOptions.rawType) {
          return this.getTypeObject();
        }
      },
      getDeclarations() {
        return (declarations ??= context.getDeclarations(
          symbol.declarations ?? [],
        ));
      },
      getTypeObject() {
        return type;
      },
    };
  }

  function resolveEvent(symbol: ts.Symbol, signature: ts.Signature): EventMeta {
    let declarations: Declaration[] | undefined;
    let schema: PropertyMetaSchema[] | undefined;
    const params = signature.parameters.map((param) =>
      context.checker.getTypeOfSymbolAtLocation(param, context.sourceFile),
    );

    return {
      name: symbol.getName(),
      description: context.ts.displayPartsToString(
        symbol.getDocumentationComment(context.checker),
      ),
      type: `[${params.map(typeToString).join(", ")}]`,
      signature: context.checker.signatureToString(signature),
      required: !(symbol.flags & context.ts.SymbolFlags.Optional),
      tags: getJsDocTags(symbol),
      get schema() {
        return (schema ??= params.map((param) => resolveSchema(param)));
      },
      get declarations() {
        return context.deprecatedOptions.noDeclarations
          ? []
          : this.getDeclarations();
      },
      get rawType() {
        if (context.deprecatedOptions.rawType) {
          return this.getTypeObject();
        }
      },
      getDeclarations() {
        return (declarations ??= context.getDeclarations(
          symbol.declarations ?? [],
        ));
      },
      getTypeObject() {
        return params[0];
      },
    } satisfies EventMeta;
  }

  function resolveSchema(
    type: ts.Type,
    visited = new Set<ts.Type>(),
  ): PropertyMetaSchema {
    const typeString = typeToString(type);

    if (shouldIgnore(type, visited)) {
      return typeString;
    }

    const nestedVisited = new Set(visited).add(type);

    if (type.isUnion()) {
      let schema: PropertyMetaSchema[] | undefined;
      return {
        kind: "enum",
        type: typeString,
        get schema() {
          return (schema ??= type.types.map((part) =>
            resolveSchema(part, nestedVisited),
          ));
        },
      };
    }

    if (
      context.checker.isArrayType(type) ||
      context.checker.isTupleType(type)
    ) {
      let schema: PropertyMetaSchema[] | undefined;
      return {
        kind: "array",
        type: typeString,
        get schema() {
          return (schema ??= getTypeArguments(type).map((argument) =>
            resolveSchema(argument, nestedVisited),
          ));
        },
      };
    }

    const signatures = type.getCallSignatures();
    if (signatures.length === 1) {
      let schema: PropertyMetaSchema[] | undefined;
      const signature = signatures[0]!;
      return {
        kind: "event",
        type: context.checker.signatureToString(signature),
        get schema() {
          return (schema ??= signature.parameters.map((param) =>
            resolveSchema(
              context.checker.getTypeOfSymbolAtLocation(
                param,
                context.sourceFile,
              ),
              nestedVisited,
            ),
          ));
        },
      };
    }

    if (
      signatures.length === 0 &&
      (type.isClassOrInterface() ||
        type.isIntersection() ||
        !!(
          (type as ts.ObjectType).objectFlags & context.ts.ObjectFlags.Anonymous
        ))
    ) {
      let schema: Record<string, PropertyMeta> | undefined;
      return {
        kind: "object",
        type: typeString,
        get schema() {
          return (schema ??= type.getProperties().reduce(
            (properties, property) => {
              const propertyType = context.checker.getTypeOfSymbolAtLocation(
                property,
                context.sourceFile,
              );
              properties[property.getName()] = resolveProperty(
                property,
                propertyType,
                {},
                nestedVisited,
              );
              return properties;
            },
            {} as Record<string, PropertyMeta>,
          ));
        },
      };
    }

    return typeString;
  }

  function typeToString(type: ts.Type) {
    return context.checker
      .typeToString(
        type,
        context.sourceFile,
        context.ts.TypeFormatFlags.UseFullyQualifiedType |
          context.ts.TypeFormatFlags.NoTruncation,
      )
      .replace(/import\(.*?\)\./g, "");
  }

  function getTypeArguments(type: ts.Type) {
    return isTypeReference(type) ? context.checker.getTypeArguments(type) : [];
  }

  function isTypeReference(type: ts.Type): type is ts.TypeReference {
    return (
      !!(type.flags & context.ts.TypeFlags.Object) &&
      !!((type as ts.ObjectType).objectFlags & context.ts.ObjectFlags.Reference)
    );
  }

  return {
    getJsDocTags,
    resolveEvent,
    resolveProperty,
    resolveSchema,
    resolveValue,
    typeToString,
  };
}
