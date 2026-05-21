import type {
  AttrTagMeta,
  BodyMeta,
  ContentMeta,
  EventMeta,
  InputMeta,
  ResultMeta,
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

  const input = meta.input;

  if (input?.props.length) {
    sections.push(
      `Input Props:\n${input.props.map(formatInputLine).join("\n")}`,
    );
  }

  if (input?.events.length) {
    sections.push(
      `Input Events:\n${input.events.map(formatEventLine).join("\n")}`,
    );
  }

  if (input?.attrTags.length) {
    sections.push(
      `Attr Tags:\n${input.attrTags.map(formatAttrTagLine).join("\n")}`,
    );
  }

  if (input?.content) {
    sections.push(`Content:\n- ${formatContentSignature(input.content)}`);
  }

  if (meta.result) {
    sections.push(formatResultMetaDocumentation(meta.result));
  }

  if (input) {
    sections.push(formatInputTypeMetaDocumentation(input));
  }

  return sections.join("\n\n");
}

export function formatInputTypeMetaDocumentation(
  input: NonNullable<TagMeta["input"]>,
) {
  return `Input:\n\n\`\`\`typescript\n${input.source || `type Input = ${input.type};`}\n\`\`\``;
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

export function formatEventMetaDocumentation(
  event: Pick<EventMeta, "description" | "name" | "signature" | "type">,
) {
  const sections = [`\`${event.name}: ${event.signature || event.type}\``];
  if (event.description) {
    sections.push(event.description);
  }
  return sections.join("\n\n");
}

export function formatAttrTagMetaDocumentation(attrTag: AttrTagMeta) {
  const sections = [formatAttrTagLine(attrTag).slice(2)];
  if (attrTag.description) {
    sections.push(attrTag.description);
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

  if (attrTag.props.length) {
    pieces.push(
      `with ${attrTag.props.map(formatInlineInputSignature).join(", ")}`,
    );
  }

  if (attrTag.events.length) {
    pieces.push(
      `events ${attrTag.events.map((event) => event.name).join(", ")}`,
    );
  }

  if (attrTag.content) {
    pieces.push(`content ${formatContentSignature(attrTag.content)}`);
  }

  return `- ${pieces.join(" ")}`;
}

function formatEventLine(
  event: Pick<EventMeta, "name" | "signature" | "type">,
) {
  return `- \`${event.name}: ${event.signature || event.type}\``;
}

function formatResultMetaDocumentation(result: ResultMeta) {
  return `Result:\n- \`${result.type}\``;
}

function formatContentSignature(content: ContentMeta) {
  return `${formatBodySignature(content)} via \`input.${content.propertyName}\``;
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
