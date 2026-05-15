# Component Meta Integration Status

The `@marko/component-meta` package is integrated into `packages/volar-language-server` for the `marko-template` plugin.

## Current Implementation

- Custom tag and custom input completion docs use component metadata.
- Custom tag and custom input hover docs use component metadata where it improves the result.
- Custom input definitions use component metadata declarations as an additive fallback after TS/taglib navigation.
- Native HTML completions and hover continue to prefer the HTML service where possible.
- Marko-specific source completions remain responsible for syntax the HTML service cannot model, including attr tags and modifiers.
- Source completion edits are normalized across Volar embedded-document requests so `textEdit` is preserved.
- Component metadata is cached per request session and enriched tag data is cached per `MarkoVirtualCode`.

## Performance Validation

A manual LSP performance harness now exists at:

- `packages/volar-language-server/src/__perf__/performance.test.ts`

Run it with:

- `npm run build -w @marko/volar-language-server`
- `npm run perf -w @marko/volar-language-server`

It measures repeated hover, completion, and definition requests through `@volar/test-utils` and prints min/median/p95/max/mean timings. Optional thresholding is available with `MARKO_PERF_MAX_P95_MS`.

## Performance Measurements

Repeated-request benchmark, 30 iterations after 5 warmups:

| Step                              | custom-tag-hover median / p95 | custom-input-completion median / p95 | native-attr-completion median / p95 | custom-tag-definition median / p95 |
| --------------------------------- | ----------------------------- | ------------------------------------ | ----------------------------------- | ---------------------------------- |
| Baseline                          | 672.91ms / 804.27ms           | 0.90ms / 1.17ms                      | 8.29ms / 29.95ms                    | 0.97ms / 1.45ms                    |
| `updateFile` unchanged-text no-op | 502.93ms / 616.15ms           | 0.90ms / 1.58ms                      | 8.57ms / 20.22ms                    | 0.97ms / 1.35ms                    |
| Enriched tag-data cache           | 1.23ms / 33.50ms              | 0.87ms / 1.07ms                      | 8.30ms / 20.89ms                    | 0.96ms / 1.32ms                    |
| Patched-host reuse refinements    | 1.11ms / 27.54ms              | 0.88ms / 1.25ms                      | 8.49ms / 20.25ms                    | 0.98ms / 1.42ms                    |

The original hover hang was caused by repeated eager metadata enrichment rebuilding or recomputing too much work. The local caching changes bring warm hover requests back to low single-digit milliseconds.

## Component Meta Cache Tests

`packages/component-meta/src/__tests__/checker.test.ts` now verifies:

- repeated metadata reads reuse the cached program
- unchanged `updateFile` calls do not recreate the program

## Vue Language Tools Comparison

Vue has two layers:

- standalone component-meta checker for CLI/offline usage
- IDE metadata requests backed by the existing tsserver/Volar program

Marko currently still uses the standalone checker from the LSP. The local caching work makes this practical for warm requests, but the long-term Vue-aligned architecture should extract shared Marko language-core primitives and add a TS-plugin metadata request path that can use the live Volar/TS program.

## Recommended Follow-Up

Create a shared `@marko/language-core` package or equivalent internal layer that both `@marko/component-meta` and `@marko/volar-language-server` can use for:

- Marko virtual-file creation
- source/virtual range mapping
- tag-file resolution
- component metadata extraction from an existing `ts.Program`

Then move LSP component metadata requests from the standalone checker to a Vue-style TS-plugin request that reuses the live TypeScript program.
