import type ts from "typescript";

export type ComponentMetaChecker = ReturnType<
  (typeof import("./checker"))["createCheckerBase"]
>;
export type TagMetaChecker = ComponentMetaChecker;

export interface Declaration {
  file: string;
  range: [number, number];
}

export interface JsDocTagMeta {
  name: string;
  text?: string;
}

export type PropertyMetaSchema =
  | string
  | { kind: "enum"; type: string; schema?: PropertyMetaSchema[] }
  | { kind: "array"; type: string; schema?: PropertyMetaSchema[] }
  | { kind: "event"; type: string; schema?: PropertyMetaSchema[] }
  | { kind: "object"; type: string; schema?: Record<string, PropertyMeta> };

export interface ValueMeta {
  name?: string;
  description: string;
  type: string;
  tags: JsDocTagMeta[];
  schema: PropertyMetaSchema;
  declarations: Declaration[];
  /**
   * @deprecated use `getTypeObject()` instead
   */
  rawType?: ts.Type;
  getDeclarations(): Declaration[];
  getTypeObject(): ts.Type | undefined;
}

export interface BodyMeta {
  description: string;
  type: string;
  tags: JsDocTagMeta[];
  schema: PropertyMetaSchema;
  parameters: ValueMeta[];
  return?: ValueMeta;
  declarations: Declaration[];
  /**
   * @deprecated use `getTypeObject()` instead
   */
  rawType?: ts.Type;
  getDeclarations(): Declaration[];
  getTypeObject(): ts.Type | undefined;
}

export interface ContentMeta extends BodyMeta {
  name: "content";
  /** The `Input` property used by the tag implementation. */
  propertyName: "content" | "renderBody";
}

export interface PropertyMeta extends ValueMeta {
  name: string;
  default?: string;
  global: boolean;
  required: boolean;
  getTypeObject(): ts.Type;
}

export interface InputMeta extends PropertyMeta {
  enumValues?: string[];
}

export interface AttrTagMeta extends PropertyMeta {
  /** The `Input` property used by the tag implementation. */
  propertyName: string;
  props: InputMeta[];
  attrTags: AttrTagMeta[];
  events: EventMeta[];
  content?: ContentMeta;
  /**
   * @deprecated use `props` instead
   */
  inputs: InputMeta[];
  /**
   * @deprecated use `content` instead
   */
  body?: ContentMeta;
}

export interface TagInputMeta extends ValueMeta {
  name: "Input";
  source?: string;
  props: InputMeta[];
  attrTags: AttrTagMeta[];
  events: EventMeta[];
  content?: ContentMeta;
}

export interface EventMeta {
  name: string;
  description: string;
  type: string;
  signature: string;
  required: boolean;
  tags: JsDocTagMeta[];
  schema: PropertyMetaSchema[];
  /**
   * @deprecated use `getDeclarations()` instead
   */
  declarations: Declaration[];
  /**
   * @deprecated use `getTypeObject()` instead
   */
  rawType?: ts.Type;
  getDeclarations(): Declaration[];
  getTypeObject(): ts.Type | undefined;
}

export interface ResultMeta extends ValueMeta {
  name: "result";
  getTypeObject(): ts.Type;
}

export interface ComponentMeta {
  file: string;
  name: string;
  description: string;
  declarations: Declaration[];
  input?: TagInputMeta;
  result?: ResultMeta;
}

export interface TagMeta extends ComponentMeta {
  /**
   * @deprecated use `input.props` instead
   */
  inputs: InputMeta[];
  /**
   * @deprecated use `input.attrTags` instead
   */
  attrTags: AttrTagMeta[];
  /**
   * @deprecated use `input.content` instead
   */
  body?: ContentMeta;
  /**
   * @deprecated use `input.events` instead
   */
  events: EventMeta[];
}

export type MetaCheckerSchemaOptions =
  | boolean
  | {
      /** Type names to avoid expanding while building nested schemas. */
      ignore?: (
        | string
        | ((
            name: string,
            type: ts.Type,
            typeChecker: ts.TypeChecker,
          ) => boolean | void | undefined | null)
      )[];
    };

export interface MetaCheckerOptions {
  schema?: MetaCheckerSchemaOptions;
  printer?: ts.PrinterOptions;
  /**
   * @deprecated Declarations are resolved lazily via `getDeclarations()`.
   */
  noDeclarations?: boolean;
  /**
   * @deprecated Marko files are type-checked through their generated service script.
   */
  forceUseTs?: boolean;
  /**
   * @deprecated use `getTypeObject()` instead
   */
  rawType?: boolean;
}
