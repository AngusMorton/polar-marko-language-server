# `@marko/component-meta`

Structured metadata for Marko custom tags.

This package builds a TypeScript-backed checker for `.marko` files and returns a
normalized view of a tag's author-facing API using Marko's own naming:

- `input.props` for ordinary `Input` properties
- `input.attrTags` for `Marko.AttrTag` properties
- `input.events` for callback/change-handler inputs such as `onX`, `on-x`, and `xChange`
- `input.content` for tag content (`content` or legacy `renderBody` input props)
- `result` for the caller-visible value from a `<return>` tag
- declaration locations, raw TypeScript types, defaults, enum values, docs, and schemas

It is intended to be the shared metadata layer for editor features such as:

- rich custom tag hover
- rich input hover
- completion documentation
- required-input hints

It is not responsible for diagnostics, references, rename, or definitions.

## Usage

```ts
import { createChecker } from "@marko/component-meta";

const checker = createChecker("/path/to/tsconfig.json");

const fancyButton = checker.getTagMeta(
  "/path/to/components/fancy-button/index.marko",
);

const sameMeta = checker.getComponentMeta(
  "/path/to/components/fancy-button/index.marko",
);

const child = checker.getTagMetaForTag("/path/to/consumer.marko", "child");
```

## API

### `createChecker(tsconfig, options?)`

Creates a checker from a `tsconfig.json` or `jsconfig.json` path.

### `createCheckerByJson(rootDir, json, options?)`

Creates a checker from an in-memory config object.

Options:

- `schema: true` expands unions, arrays, objects, and callbacks into nested schemas.
- `schema.ignore` skips named types while expanding schemas.
- `noDeclarations` and `rawType` are deprecated compatibility options. Prefer
  `getDeclarations()` and `getTypeObject()` on metadata items.

### `checker.getComponentMeta(fileName)`

Alias for `checker.getTagMeta(fileName)`.

### `checker.getTagMeta(fileName)`

Returns metadata for a specific Marko tag file.

The result includes:

- `file`
- `name`
- `description`
- `declarations`
- `input`
- `result`

For compatibility with existing editor integrations, these deprecated aliases
are also currently available:

- `inputs`
- `attrTags`
- `body`
- `events`

### `checker.getExportNames(fileName)`

Returns TypeScript export names from the generated service script for a Marko
file.

### `checker.getTagMetaForTag(importerFileName, tagName)`

Resolves a tag name in the importing file's tag lookup and returns metadata for
the resolved tag file when one exists.

### `checker.getTagNames(importerFileName)`

Returns the custom tag names visible from the importing file.

### `checker.updateFile(fileName, text)`

Updates an in-memory file and invalidates caches.

### `checker.deleteFile(fileName)`

Deletes an in-memory file from the checker and invalidates caches.

### `checker.reload()`

Reloads the config and clears caches.

### `checker.clearCache()`

Clears internal snapshots, extracted Marko output, and computed metadata.

## Notes

- This package is optimized for custom Marko tags, not native HTML tags.
- Tag resolution is file-based. Scope-sensitive local tags should still be
  resolved by a caller using TypeScript/codegen navigation first.
- Declaration ranges for `.marko` files are mapped back from generated
  TypeScript to the original source offsets.
