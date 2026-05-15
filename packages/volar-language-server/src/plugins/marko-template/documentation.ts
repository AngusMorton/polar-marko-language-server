import type {
  AttrTagMeta,
  BodyMeta,
  InputMeta,
  TagMeta,
} from "@marko/component-meta";

export function formatTagMetaDocumentation(
  meta: TagMeta,
  options: { includeDescription?: boolean } = {},
) {
  const sections: string[] = [];

  if (options.includeDescription !== false && meta.description) {
    sections.push(meta.description);
  }

  if (meta.inputs.length) {
    sections.push(
      `Attributes:\n${meta.inputs.map(formatInputLine).join("\n")}`,
    );
  }

  if (meta.attrTags.length) {
    sections.push(
      `Attr Tags:\n${meta.attrTags.map(formatAttrTagLine).join("\n")}`,
    );
  }

  if (meta.body) {
    sections.push(`Body:\n- ${formatBodySignature(meta.body)}`);
  }

  return sections.join("\n\n");
}

export function formatInputMetaDocumentation(
  input: Pick<
    InputMeta,
    "description" | "enumValues" | "name" | "required" | "type"
  >,
  fallbackDescription?: string,
) {
  const sections = [formatInlineInputSignature(input)];
  const description = input.description || fallbackDescription;

  if (description) {
    sections.push(description);
  }

  if (input.enumValues?.length) {
    sections.push(
      `Values: ${input.enumValues.map((value) => `\`${value}\``).join(", ")}`,
    );
  }

  return sections.join("\n\n");
}

function formatInputLine(input: Pick<InputMeta, "name" | "required" | "type">) {
  return `- ${formatInlineInputSignature(input)}`;
}

function formatInlineInputSignature(
  input: Pick<InputMeta, "name" | "required" | "type">,
) {
  return `\`${input.name}${input.required ? "" : "?"}: ${input.type}\``;
}

function formatAttrTagLine(attrTag: AttrTagMeta) {
  const pieces = [`\`@${attrTag.name}${attrTag.required ? "" : "?"}\``];

  if (attrTag.inputs.length) {
    pieces.push(
      `with ${attrTag.inputs.map(formatInlineInputSignature).join(", ")}`,
    );
  }

  if (attrTag.body) {
    pieces.push(`body ${formatBodySignature(attrTag.body)}`);
  }

  return `- ${pieces.join(" ")}`;
}

function formatBodySignature(body: BodyMeta) {
  const params = body.parameters.length
    ? body.parameters
        .map((param, index) => `${param.name || `arg${index}`}: ${param.type}`)
        .join(", ")
    : "";
  const returnType = body.return ? ` => ${body.return.type}` : "";
  return `\`(${params})${returnType}\``;
}
