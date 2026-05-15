import type { TagDefinition } from "@marko/compiler/babel-utils";
import path from "path";
import type {
  IAttributeData,
  IHTMLDataProvider,
  ITagData,
  IValueData,
  MarkupContent,
} from "vscode-html-languageservice";
import { URI } from "vscode-uri";

import type { MarkoVirtualCode } from "../../language";
import type { MarkoComponentMetaManager } from "./component-meta";
import {
  formatInputMetaDocumentation,
  formatTagMetaDocumentation,
} from "./documentation";

const HTML_DATA_PROVIDER_ID = "marko-template";

export function createMarkoDataProvider(
  root: MarkoVirtualCode,
  componentMetaManager?: MarkoComponentMetaManager,
): IHTMLDataProvider {
  const componentMeta = componentMetaManager?.prepare(root);

  return {
    getId: () => HTML_DATA_PROVIDER_ID,
    isApplicable: () => true,
    provideTags: () => getTagData(root, componentMeta),
    provideAttributes: (tagName) =>
      getAttributeData(root, tagName, componentMeta),
    provideValues: (tagName, attrName) =>
      getValueData(root, tagName, attrName, componentMeta),
  };
}

function getTagData(
  root: MarkoVirtualCode,
  componentMeta?: ReturnType<MarkoComponentMetaManager["prepare"]>,
): ITagData[] {
  const tags: ITagData[] = [];

  for (const tag of root.tagLookup.getTagsSorted()) {
    if (shouldSkipTag(tag)) {
      continue;
    }

    tags.push({
      name: tag.name,
      description: getTagDocumentation(
        tag,
        root.fileName,
        componentMeta?.getTagMetaForTag(tag.name),
      ),
      attributes: [],
    });
  }

  return tags;
}

function getAttributeData(
  root: MarkoVirtualCode,
  tagName: string,
  componentMeta?: ReturnType<MarkoComponentMetaManager["prepare"]>,
) {
  const attributes: IAttributeData[] = [];
  const seenNames = new Set<string>();
  const tagDef = root.tagLookup.getTag(tagName);
  const tagMeta = componentMeta?.getTagMetaForTag(tagName);
  const nestedTagAttrs = new Set<string>();

  if (tagDef?.nestedTags) {
    for (const key in tagDef.nestedTags) {
      nestedTagAttrs.add(tagDef.nestedTags[key].targetProperty);
    }
  }

  root.tagLookup.forEachAttribute(tagName, (attr, parent) => {
    if (!attr) {
      return;
    }

    if (
      attr.deprecated ||
      nestedTagAttrs.has(attr.name) ||
      attr.name === "*" ||
      attr.type === "never" ||
      (attr.name[0] === "_" &&
        isExternalModule(attr.filePath || parent?.filePath || ""))
    ) {
      return;
    }

    const inputMeta = tagMeta?.inputs.find((input) => input.name === attr.name);
    const documentation = getAttributeDocumentation(
      attr.description,
      inputMeta,
    );
    const autocomplete = Array.isArray(attr.autocomplete)
      ? attr.autocomplete[0]
      : attr.autocomplete;
    let name = attr.name;
    const values: IValueData[] = [];

    if (autocomplete?.displayText) {
      name = autocomplete.displayText;
    }
    seenNames.add(attr.name);

    for (const value of inputMeta?.enumValues ?? attr.enum ?? []) {
      values.push({ name: value });
    }

    attributes.push({
      name,
      description: appendMoreInfo(
        documentation,
        autocomplete?.descriptionMoreURL,
      ),
      values: values.length ? values : undefined,
    });
  });

  for (const input of tagMeta?.inputs ?? []) {
    if (seenNames.has(input.name) || nestedTagAttrs.has(input.name)) {
      continue;
    }

    attributes.push({
      name: input.required ? input.name : `${input.name}?`,
      description: {
        kind: "markdown",
        value: formatInputMetaDocumentation(input),
      },
      values: input.enumValues?.map((value) => ({ name: value })),
    });
  }

  return attributes;
}

function getValueData(
  root: MarkoVirtualCode,
  tagName: string,
  attrName: string,
  componentMeta?: ReturnType<MarkoComponentMetaManager["prepare"]>,
) {
  const normalizedName = attrName.endsWith("?")
    ? attrName.slice(0, -1)
    : attrName;
  const metaValues = componentMeta?.getInputMetaForTag(
    tagName,
    normalizedName,
  )?.enumValues;
  const values: IValueData[] = [];

  for (const value of metaValues ?? []) {
    values.push({ name: value });
  }

  if (values.length) {
    return values;
  }

  root.tagLookup.forEachAttribute(tagName, (attr) => {
    if (!attr) {
      return;
    }

    if (attr.name !== normalizedName) {
      return;
    }

    for (const value of attr.enum ?? []) {
      values.push({ name: value });
    }
  });

  return values;
}

function shouldSkipTag(tag: TagDefinition) {
  return (
    tag.name === "*" ||
    tag.isNestedTag ||
    tag.parseOptions?.statement ||
    (tag.name[0] === "_" &&
      /^@?marko[/-]|[\\/]node_modules[\\/]/.test(tag.filePath))
  );
}

function getTagDocumentation(
  tag: TagDefinition,
  importer: string,
  meta?: Parameters<typeof formatTagMetaDocumentation>[0],
): MarkupContent {
  let value = "";
  const fileForTag = tag.template || tag.renderer || tag.filePath;
  const fileUri = URI.file(fileForTag).toString();
  const nodeModuleMatch = /\/node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(
    fileForTag,
  );
  const nodeModuleName = nodeModuleMatch?.[1];
  const isCoreTag =
    /^@?marko[/-]/.test(tag.taglibId || tag.filePath) ||
    nodeModuleName === "marko";

  if (tag.html) {
    value = `Built in [&lt;${tag.name}&gt;](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/${tag.name}) HTML tag.`;
  } else if (isCoreTag) {
    value = `Core Marko &lt;${tag.name}&gt; tag.`;
  } else if (nodeModuleName) {
    value = `Custom Marko tag discovered from the ["${nodeModuleName}"](${fileUri}) npm package.`;
  } else {
    value = `Custom Marko tag discovered from:\n\n[${path.relative(importer, fileForTag)}](${fileUri})`;
  }

  if (tag.description) {
    value += `\n\n${tag.description}`;
  }

  const autocomplete = tag.autocomplete?.[0];
  if (autocomplete?.description) {
    value += `\n\n${autocomplete.description}`;
  }

  if (autocomplete?.descriptionMoreURL) {
    value += `\n\n[More Info](${autocomplete.descriptionMoreURL})`;
  }

  const metaDocumentation = meta
    ? formatTagMetaDocumentation(meta, {
        includeDescription: !tag.description,
      })
    : "";
  if (metaDocumentation) {
    value += value ? `\n\n${metaDocumentation}` : metaDocumentation;
  }

  return {
    kind: "markdown",
    value,
  };
}

function getAttributeDocumentation(
  description: string | undefined,
  inputMeta?: Parameters<typeof formatInputMetaDocumentation>[0],
): MarkupContent | undefined {
  const value = inputMeta
    ? formatInputMetaDocumentation(inputMeta, description)
    : description;
  if (!value) {
    return;
  }

  return {
    kind: "markdown",
    value,
  };
}

function appendMoreInfo(
  documentation: MarkupContent | undefined,
  moreInfoUrl: string | undefined,
): MarkupContent | undefined {
  if (!moreInfoUrl) {
    return documentation;
  }

  return {
    kind: "markdown",
    value: documentation?.value
      ? `${documentation.value}\n\n[More Info](${moreInfoUrl})`
      : `[More Info](${moreInfoUrl})`,
  };
}

function isExternalModule(file: string) {
  return (
    /[/\\]node_modules[/\\]/.test(file) || !/^(?:[A-Za-z]:\\|[./\\])/.test(file)
  );
}
