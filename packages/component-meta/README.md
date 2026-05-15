# `@marko/component-meta`

Structured metadata for Marko custom tags.

This package builds a TypeScript-backed checker for `.marko` files and returns a
normalized view of a tag's author-facing API:

- top-level inputs
- attr tags
- body parameters
- declaration locations
- merged docs and enum values from TypeScript and taglib metadata

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

const child = checker.getTagMetaForTag("/path/to/consumer.marko", "child");
```

## API

### `createChecker(tsconfig, options?)`

Creates a checker from a `tsconfig.json` or `jsconfig.json` path.

### `createCheckerByJson(rootDir, json, options?)`

Creates a checker from an in-memory config object.

### `checker.getTagMeta(fileName)`

Returns metadata for a specific Marko tag file.

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
