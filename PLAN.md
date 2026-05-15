# Current Goal

Integrate the new `@marko/component-meta` workspace package into `packages/volar-language-server` so that the Volar-based Marko template experience can use structured Marko-native metadata for custom tags and custom tag inputs.

The intended outcome is:

- custom tag hover should include richer Marko-native metadata
- custom tag attribute hover should include richer input metadata
- custom tag completion documentation should include richer metadata
- custom tag attribute completion documentation should include richer metadata
- existing definition/navigation ownership should remain unchanged
- all existing tests should continue to pass

This work is specifically scoped to enriching documentation/completion metadata. It is not intended to replace the existing TS/codegen-backed definition flow or compiler diagnostics flow.

# Design Intent

The intended architecture for this integration is:

- `@marko/component-meta` remains a standalone shared package
- `marko-template` in `packages/volar-language-server` consumes component metadata
- metadata is used only to enrich hover/completion/data-provider docs for custom tags and inputs
- HTML-native tags should continue to rely on the HTML service / existing taglib data
- TS/codegen-backed navigation should remain the owner for definition/reference style features
- source-aware Marko completions should continue to own syntax that HTML/TS cannot model well

The concrete goal inside the Volar plugin is to make `marko-template` the place where component metadata is attached to:

- HTML-backed tag docs
- source fallback tag hover
- source fallback attribute hover
- source attribute completions
- HTML data-provider output for custom tags/attrs

# What Was Already True Before This Integration Work

Before this round of work started, the following was already complete and green:

- `packages/component-meta` had been created and implemented
- local `component-meta` build/test was green
- full root workspace build was green
- the earlier `marko-template` vs `marko` plugin split was already done
- `marko-template` already owned template completions / hover / definition / document links / document symbols
- `marko` already only owned diagnostics
- `packages/volar-language-server` had already been fully green after the earlier refactor

# Detailed Progress In This Session

## 1. Added `component-meta` integration primitives to `marko-template`

New files added:

- `packages/volar-language-server/src/plugins/marko-template/component-meta.ts`
- `packages/volar-language-server/src/plugins/marko-template/documentation.ts`

### `component-meta.ts`

This file introduces a lightweight project-scoped metadata manager.

It currently does the following:

- imports `createChecker` / `createCheckerByJson` from `@marko/component-meta`
- caches checkers by inferred project key
- tries to resolve a nearby `tsconfig.json` or `jsconfig.json`
- falls back to an inferred in-memory config when no TS config is found
- updates the checker with the current in-memory Marko document text on every `prepare(root)` call
- exposes a session API:
  - `getTagMetaForTag(tagName)`
  - `getInputMetaForTag(tagName, attrName)`

### `documentation.ts`

This file introduces common Markdown formatting helpers for metadata:

- `formatTagMetaDocumentation(...)`
- `formatInputMetaDocumentation(...)`

It currently formats:

- top-level input summaries
- attr tag summaries
- body signatures
- input signatures and enum values

## 2. Wired component metadata into the HTML data provider

Updated file:

- `packages/volar-language-server/src/plugins/marko-template/data-provider.ts`

Changes made:

- `createMarkoDataProvider(...)` now optionally accepts a `MarkoComponentMetaManager`
- the provider prepares a metadata session for the current root document
- tag docs now append metadata-derived sections
- attribute docs now use metadata-derived input signatures when available
- metadata enum values are used for value docs when present
- custom tag inputs that are missing from taglib attribute enumeration are now synthesized into the provider output

This last part mattered because real custom tag fixtures like `fancy-button` only exposed wildcard/core attrs through taglib lookup, while the actual author-facing input `message` existed only in component metadata.

## 3. Wired component metadata into hover handling

Updated file:

- `packages/volar-language-server/src/plugins/marko-template/hover.ts`

Changes made:

- `provideHover(...)` now accepts an optional metadata session
- source fallback hover now uses metadata for custom tags
- source fallback hover now uses metadata for custom tag attrs
- HTML tag hover continues to use existing HTML/taglib behavior
- modifier hover behavior remains intact

Current status of hover integration:

- custom tag hover from component meta is working
- custom attr hover from component meta is working
- existing native HTML / modifier hover tests still pass

## 4. Wired component metadata into source attr completions

Updated files:

- `packages/volar-language-server/src/plugins/marko-template/source-completions.ts`
- `packages/volar-language-server/src/plugins/marko/complete/AttrName.ts`

Changes made:

- source-only completions now receive the metadata session
- `AttrName(...)` now accepts optional `tagMeta`
- attribute completion docs now use metadata-derived input signatures when available
- metadata-only custom inputs missing from taglib enumeration are synthesized into source attr completions

This made local/source completion generation for custom attrs work in isolation.

## 5. Wired the manager into the template plugin entrypoint

Updated files:

- `packages/volar-language-server/src/plugins/marko-template/index.ts`
- `packages/volar-language-server/src/plugins/marko-template/html-service.ts`

Changes made:

- `createComponentMetaManager(ts)` is now created in the `marko-template` plugin
- the HTML service now receives the metadata manager
- completion path prepares a metadata session per request
- hover path prepares a metadata session per request

## 6. Added tests for the new metadata behavior

Updated tests:

- `packages/volar-language-server/src/plugins/marko-template/__tests__/data-provider.test.ts`
- `packages/volar-language-server/src/__tests__/completion.test.ts`
- `packages/volar-language-server/src/__tests__/navigation.test.ts`

Added assertions cover:

- custom tag docs enriched with metadata in the HTML data provider
- custom input docs enriched with metadata in the HTML data provider
- custom tag hover enriched with metadata
- custom custom-tag attr hover enriched with metadata
- custom tag input completion docs from component meta

## 7. Added workspace/package wiring

Updated files:

- `packages/volar-language-server/package.json`
- `packages/volar-language-server/tsconfig.json`

Changes made:

- added `@marko/component-meta` as a dependency in `packages/volar-language-server/package.json`
- added a TS project reference from `volar-language-server` to `component-meta`
- ran `npm install` to update workspace linking and lockfile state

# Verification Performed So Far

## Build / install steps completed

These succeeded:

- `npm install`
- `npm run build -w @marko/component-meta`
- `npm run build -w @marko/volar-language-server`

## Component-meta package verification

This succeeded:

- `npm run test -w @marko/component-meta`

Result:

- `6 passing`

## Targeted server verification

Repeated targeted runs were executed with:

- `npm run test -w @marko/volar-language-server -- --grep "marko-template data provider|completion|navigation"`

Current targeted result:

- most of the new metadata integration is working
- custom tag hover test is green
- custom custom-tag attr hover test is green
- custom tag input completion metadata test is now green
- HTML data-provider enrichment test is green
- one pre-existing attr-completion shape expectation is now regressed

# Current Exact State Of The Code

## Working

The following now work:

- metadata manager creation and checker caching
- metadata formatting helpers
- HTML data-provider enrichment for custom tags
- HTML data-provider synthesis of metadata-only custom inputs
- custom tag hover from component meta
- custom custom-tag attr hover from component meta
- source attr completion generation for metadata-only custom inputs in isolated/unit path
- completion test for custom tag input docs from component meta

## Current Remaining Regression

There is currently one known failing test in `packages/volar-language-server`:

- file: `packages/volar-language-server/src/__tests__/completion.test.ts`
- test: `provides attribute name completions with snippets`

Current failure details:

- expected: `getNewText(item) === "class"`
- actual: `getNewText(item) === undefined`

This regression appeared after changing script completion mapping ownership for Marko attribute-name tokens.

## Why That Regression Happened

The custom-tag input metadata completion problem was caused by embedded-script TypeScript completions winning over `marko-template` source attr completions.

To fix that, `packages/volar-language-server/src/language/parseScript.ts` was changed so that generated script mappings for source `AttrName` tokens no longer expose `completion: true`.

That change successfully fixed the custom-tag metadata completion case, but it also changed how unresolved attr-name completion items flow back through Volar transport for normal attrs.

Observed current behavior for the failing standard attr completion case:

- the `class?` completion item is still returned
- the item still contains the expected replacement edit, but it is currently stored inside `item.data.original.textEdit`
- the top-level `item.textEdit` is missing in the unresolved result returned by the server
- the existing test helper reads `item.textEdit?.newText`, so it now sees `undefined`

This means the remaining issue is not that the completion disappeared. The remaining issue is that unresolved source completions on the embedded-document path are not being normalized back to top-level `textEdit` before the response is returned.

# Important Intermediate Debugging Findings

## Finding: custom tag inputs are not always visible through taglib attr enumeration

For the `tags-api-basic` fixture, runtime inspection showed:

- `root.tagLookup.getTag("fancy-button")` resolves correctly
- `root.tagLookup.forEachAttribute("fancy-button", ...)` only exposes wildcard/core attrs
- the actual input `message` only appears in component metadata

This is why synthetic metadata-only attrs had to be appended in both:

- `data-provider.ts`
- `marko/complete/AttrName.ts`

## Finding: custom-tag completion docs were being lost because TS completions won the merge

Live server inspection showed that for `<fancy-button mess█/>`:

- the visible `message` completion was coming from embedded TypeScript
- the unresolved item had no docs body
- resolved item had `detail: "(property) Input.message: string"` but empty markdown doc body

This was why the first custom metadata completion assertion failed even though local source-only generation was already correct.

## Finding: source-only generation itself is correct

Direct inspection of `provideSourceOnlyCompletions(...)` for `<fancy-button mess█/>` showed it returns:

- a `message` completion item
- with `documentation.value === "`message: string`"`
- with a snippet edit of `message="$1"$0`

So the remaining work is in transport/normalization/ownership, not metadata extraction.

# Files Modified In This Session

New files:

- `packages/volar-language-server/src/plugins/marko-template/component-meta.ts`
- `packages/volar-language-server/src/plugins/marko-template/documentation.ts`

Modified files:

- `packages/volar-language-server/package.json`
- `packages/volar-language-server/tsconfig.json`
- `packages/volar-language-server/src/plugins/marko-template/index.ts`
- `packages/volar-language-server/src/plugins/marko-template/html-service.ts`
- `packages/volar-language-server/src/plugins/marko-template/data-provider.ts`
- `packages/volar-language-server/src/plugins/marko-template/hover.ts`
- `packages/volar-language-server/src/plugins/marko-template/source-completions.ts`
- `packages/volar-language-server/src/plugins/marko/complete/AttrName.ts`
- `packages/volar-language-server/src/plugins/shared/marko-documents.ts`
- `packages/volar-language-server/src/language/parseScript.ts`
- `packages/volar-language-server/src/plugins/marko-template/__tests__/data-provider.test.ts`
- `packages/volar-language-server/src/__tests__/completion.test.ts`
- `packages/volar-language-server/src/__tests__/navigation.test.ts`

# Current Recommended Next Steps

There is one concrete remaining task to finish this integration cleanly:

1. Normalize unresolved source attr completion items so the top-level response preserves `textEdit`.

Likely good fix locations:

- `packages/volar-language-server/src/plugins/marko-template/index.ts`
- or `packages/volar-language-server/src/plugins/marko-template/util.ts`

The desired behavior is:

- when `marko-template` returns source completions from the embedded script completion path, keep the top-level `textEdit` on the returned item instead of only inside `item.data.original`
- this should restore the existing `class?` snippet completion shape
- while keeping the new custom-tag input metadata completion ownership fix intact

After that, rerun verification in this order:

1. `npm run build -w @marko/volar-language-server`
2. `npm run test -w @marko/volar-language-server -- --grep "marko-template data provider|completion|navigation"`
3. `npm run test -w @marko/volar-language-server`
4. `npm run build`

# Current Bottom Line

The `component-meta` integration is mostly complete and working.

The feature-level goal has been achieved for:

- custom tag hover docs
- custom custom-tag attr hover docs
- HTML data-provider docs for custom tags and metadata-only inputs
- custom tag input completion metadata

The repo is not fully green yet because there is one remaining regression in ordinary attribute-name completion item shape, introduced while making `marko-template` own attr-name completion metadata for custom tags.

This is the only known remaining blocker before full end-to-end verification can be declared green.
