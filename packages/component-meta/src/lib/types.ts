import type ts from "typescript";

export type TagMetaChecker = ReturnType<
  (typeof import("./checker"))["createCheckerBase"]
>;

export interface Declaration {
  file: string;
  range: [number, number];
}

export interface ValueMeta {
  name?: string;
  description: string;
  type: string;
  declarations: Declaration[];
}

export interface BodyMeta {
  description: string;
  type: string;
  parameters: ValueMeta[];
  return?: ValueMeta;
}

export interface InputMeta extends ValueMeta {
  name: string;
  required: boolean;
  enumValues?: string[];
}

export interface AttrTagMeta extends ValueMeta {
  name: string;
  required: boolean;
  inputs: InputMeta[];
  body?: BodyMeta;
}

export interface TagMeta {
  file: string;
  name: string;
  description: string;
  declarations: Declaration[];
  inputs: InputMeta[];
  attrTags: AttrTagMeta[];
  body?: BodyMeta;
}

export interface MetaCheckerOptions {
  printer?: ts.PrinterOptions;
}
