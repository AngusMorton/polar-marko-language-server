import type { TagDefinition } from "@marko/compiler/babel-utils";
import type { MarkoVirtualCode } from "@marko/language-core";
import type { LanguageServiceContext } from "@volar/language-service";
import path from "path";
import type {
  IAttributeData,
  IHTMLDataProvider,
  ITagData,
  IValueData,
  MarkupContent,
} from "vscode-html-languageservice";
import { URI } from "vscode-uri";

import type {
  MarkoComponentMetaManager,
  MarkoComponentMetaSession,
} from "./component-meta";
import {
  getComponentMetaCacheIdentity,
  getComponentMetaCacheVersion,
} from "./component-meta";
import {
  formatInputMetaDocumentation,
  formatTagMetaDocumentation,
} from "./documentation";

const HTML_DATA_PROVIDER_ID = "marko-template";
const undefinedContext = {};
const undefinedComponentMeta = {};
const providerCache = new WeakMap<
  MarkoVirtualCode,
  WeakMap<object, WeakMap<object, IHTMLDataProvider>>
>();
const enrichedTagDataCache = new WeakMap<
  MarkoVirtualCode,
  WeakMap<object, { version: number; tags: ITagData[] }>
>();

export function createMarkoDataProvider(
  root: MarkoVirtualCode,
  componentMetaManager?: MarkoComponentMetaManager,
  context?: LanguageServiceContext,
  preparedComponentMeta?: MarkoComponentMetaSession,
): IHTMLDataProvider {
  const componentMeta =
    preparedComponentMeta ?? componentMetaManager?.prepare(root, context);
  const contextKey = context ?? undefinedContext;
  const componentMetaKey =
    getComponentMetaCacheIdentity(componentMeta) ?? undefinedComponentMeta;
  let providersByContext = providerCache.get(root);
  if (!providersByContext) {
    providersByContext = new WeakMap();
    providerCache.set(root, providersByContext);
  }

  let providersByComponentMeta = providersByContext.get(contextKey);
  if (!providersByComponentMeta) {
    providersByComponentMeta = new WeakMap();
    providersByContext.set(contextKey, providersByComponentMeta);
  }

  let provider = providersByComponentMeta.get(componentMetaKey);
  if (provider) {
    return provider;
  }

  provider = {
    getId: () => HTML_DATA_PROVIDER_ID,
    isApplicable: () => true,
    provideTags: () => getTagData(root, componentMeta),
    provideAttributes: (tagName) =>
      getAttributeData(root, tagName, componentMeta),
    provideValues: (tagName, attrName) =>
      getValueData(root, tagName, attrName, componentMeta),
  };
  providersByComponentMeta.set(componentMetaKey, provider);
  return provider;
}

function getTagData(
  root: MarkoVirtualCode,
  componentMeta?: MarkoComponentMetaSession,
): ITagData[] {
  const componentMetaKey = getComponentMetaCacheIdentity(componentMeta);
  const componentMetaVersion = getComponentMetaCacheVersion(componentMeta);
  if (componentMetaKey) {
    const cached = enrichedTagDataCache.get(root)?.get(componentMetaKey);
    if (cached?.version === componentMetaVersion) {
      return cached.tags;
    }
  }

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

  for (const tagName of getImportedTagNames(root.code)) {
    if (tags.some((tag) => tag.name === tagName)) {
      continue;
    }

    const tagMeta = componentMeta?.getTagMetaForTag(tagName);
    if (!tagMeta) {
      continue;
    }

    const sourceLink = tagMeta.file
      ? getCustomTagSourceLink(tagMeta.file, root.fileName)
      : "";
    const metaDocumentation = formatTagMetaDocumentation(tagMeta);

    tags.push({
      name: tagName,
      description: {
        kind: "markdown",
        value: sourceLink
          ? metaDocumentation
            ? `${sourceLink}\n\n${metaDocumentation}`
            : sourceLink
          : metaDocumentation,
      },
      attributes: [],
    });
  }

  if (componentMetaKey) {
    let cacheForRoot = enrichedTagDataCache.get(root);
    if (!cacheForRoot) {
      cacheForRoot = new WeakMap();
      enrichedTagDataCache.set(root, cacheForRoot);
    }
    cacheForRoot.set(componentMetaKey, {
      version: componentMetaVersion,
      tags,
    });
  }

  return tags;
}

function getAttributeData(
  root: MarkoVirtualCode,
  tagName: string,
  componentMeta?: MarkoComponentMetaSession,
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

    const inputMeta = tagMeta?.input?.props.find(
      (input) => input.name === attr.name,
    );
    const autocomplete = Array.isArray(attr.autocomplete)
      ? attr.autocomplete[0]
      : attr.autocomplete;
    const documentation = getAttributeDocumentation(
      getAttributeDescription(attr.description, autocomplete?.description),
      inputMeta,
    );
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

  if (tagMeta?.input) {
    for (const input of tagMeta.input.props) {
      if (nestedTagAttrs.has(input.name)) {
        continue;
      }

      const existingIndex = attributes.findIndex(
        (attr) => attr.name === input.name,
      );
      const inputData = {
        name: input.name,
        description: {
          kind: "markdown",
          value: formatInputMetaDocumentation(input),
        },
        values: input.enumValues?.map((value) => ({ name: value })),
      } satisfies IAttributeData;

      if (existingIndex === -1) {
        attributes.push(inputData);
      } else {
        attributes[existingIndex] = inputData;
      }

      seenNames.add(input.name);
    }
  }

  for (const event of tagMeta?.input?.events ?? []) {
    if (seenNames.has(event.name) || nestedTagAttrs.has(event.name)) {
      continue;
    }

    attributes.push({
      name: event.name,
      description: {
        kind: "markdown",
        value: `\`${event.name}: ${event.signature || event.type}\`${
          event.description ? `\n\n${event.description}` : ""
        }`,
      },
    });
  }

  return attributes;
}

function getImportedTagNames(source: string) {
  const tagNames: string[] = [];
  const importReg = /\bimport\s+([A-Za-z_$][\w$]*)\s+from\s+["'][^"']+["']/g;
  let match: RegExpExecArray | null;
  while ((match = importReg.exec(source))) {
    tagNames.push(match[1]!);
  }
  return tagNames;
}

function getValueData(
  root: MarkoVirtualCode,
  tagName: string,
  attrName: string,
  componentMeta?: MarkoComponentMetaSession,
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

/**
 * Builds the "Custom Marko tag discovered from …" source link shown for custom
 * tags, whether they are resolved from the taglib or imported by identifier, so
 * both render consistently.
 */
function getCustomTagSourceLink(fileForTag: string, importer: string) {
  // Component metadata reports the generated `*.marko.ts` virtual file; link to
  // the authored `.marko` source instead.
  fileForTag = fileForTag.replace(
    /\.marko\.(?:[cm]?tsx?|[cm]?jsx?)$/,
    ".marko",
  );
  const fileUri = URI.file(fileForTag).toString();
  const nodeModuleMatch = /\/node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(
    fileForTag,
  );
  const nodeModuleName = nodeModuleMatch?.[1];

  if (nodeModuleName && nodeModuleName !== "marko") {
    return `Custom Marko tag discovered from the ["${nodeModuleName}"](${fileUri}) npm package.`;
  }

  return `Custom Marko tag discovered from:\n\n[${path.relative(importer, fileForTag)}](${fileUri})`;
}

function getTagDocumentation(
  tag: TagDefinition,
  importer: string,
  meta?: Parameters<typeof formatTagMetaDocumentation>[0],
): MarkupContent {
  let value = "";
  const fileForTag = tag.template || tag.renderer || tag.filePath;
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
  } else {
    value = getCustomTagSourceLink(fileForTag, importer);
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

function getAttributeDescription(
  description: string | undefined,
  autocompleteDescription: string | undefined,
) {
  if (!description) {
    return autocompleteDescription;
  }

  return autocompleteDescription
    ? `${description}\n\n${autocompleteDescription}`
    : description;
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
