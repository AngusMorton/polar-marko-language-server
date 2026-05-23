# Marko LSP Performance Improvement Plan

Goal: reduce repeated warmed hover, completion, and definition requests that need component metadata to p95 <= 50-60ms, while preserving correctness after file edits, closes, and project reloads.

Execution rules:

- Each stage is scoped for one small commit. Commit the completed stage before starting the next stage.
- Do not start the next implementation stage until the review checkpoint for the current stage is complete.
- Keep changes minimal; prefer long-lived caches with clear invalidation over broad rewrites.
- Run focused tests for each stage, then the broader verification listed at the end before merging the full series.

## Baseline Targets

Measure before Stage 1 and after every runtime optimization stage.

- Warm repeated metadata-backed hover p95: target <= 50-60ms.
- Warm repeated metadata-backed completion p95: target <= 50-60ms.
- Warm repeated definition p95: target <= 50-60ms.
- Repeated requests for the same tag should not call `_marko:getComponentMeta` more than once per unchanged project/tag/import context.
- HTML custom data should not be rebuilt or emit change notifications for unchanged root/context/provider state.
- Metadata remains correct after editing, closing, deleting, and reopening tag-like files.

Suggested verification commands:

```sh
npm run build -w @marko/component-meta -w @marko/language-core -w @marko/volar-language-server
npm run test -w @marko/component-meta
npm run test -w @marko/volar-language-server
npm run perf -w @marko/volar-language-server
npm run lint
```

## Stage 1: Long-Lived Component Metadata Sessions

Scope: stop creating request-local metadata maps in `prepare()` so warmed LSP requests reuse loaded tag metadata and in-flight metadata promises.

Expected files:

- `packages/volar-language-server/src/plugins/marko-template/component-meta.ts`
- Existing tests under `packages/volar-language-server/src/**/__tests__`, only if behavior needs coverage.

Implementation notes:

- Move `tagMetaByName` and `pendingTagMetaByName` to manager/plugin-instance lifetime instead of `prepare()` lifetime.
- Cache by enough context to avoid stale or wrong answers. At minimum include normalized importer file name plus normalized tag name; include explicit imported tag file when present.
- Deduplicate concurrent loads for the same key.
- Add a small invalidation hook only if an existing edit/reload signal is available in this layer. Otherwise keep invalidation for a later stage where project versioning is available.
- Keep `MarkoComponentMetaSession` stable enough that repeated `prepare(root, context)` for the same root/context can return the same session or share the same backing cache.

Acceptance criteria:

- Repeated hover/completion/definition on the same unchanged component does not re-request `_marko:getComponentMeta` for the same tag.
- Concurrent requests for the same tag share one promise.
- Metadata for default imports and `<tag-name>` imports remains correct.
- No broad eager preload is introduced.

Likely tests:

```sh
npm run build -w @marko/component-meta -w @marko/language-core -w @marko/volar-language-server
npm run test -w @marko/volar-language-server
```

Review checkpoint:

- Confirm cache keys cannot mix metadata between files that use the same local tag name for different imported components.
- Confirm there is no unbounded per-request object growth.
- Commit Stage 1 before starting Stage 2.

## Stage 2: Cache TypeScript Plugin Metadata Extraction

Scope: avoid calling `info.languageService.getProgram()` and `extractTagMetaFromProgram()` on every `_marko:getComponentMeta` request when the project and target file are unchanged.

Expected files:

- `packages/volar-language-server/src/ts-plugin/index.ts`
- Possibly `packages/volar-language-server/src/ts-plugin/requests.ts` if request data needs a cache-safe key.

Implementation notes:

- Add plugin-level cache for resolved file metadata keyed by normalized file name plus a project/program version token.
- Prefer a cheap version source from `languageServiceHost` or the TypeScript project service if available. If no explicit project version exists here, use the `Program` object identity as the version token and clear old entries when it changes.
- Cache negative results for unresolved tag files only when the same version token is valid.
- Resolve `tagFileName` and tag names before cache lookup so equivalent requests share entries.
- Keep `getProgram()` inside request handling, matching the Vue pattern, but avoid repeated extraction for the same unchanged program/file.

Acceptance criteria:

- Repeated `_marko:getComponentMeta` requests for the same file and unchanged program reuse extracted metadata.
- Cache invalidates when the TS program changes after edits.
- Unresolved tags do not poison future results after a program change.

Likely tests:

```sh
npm run build -w @marko/component-meta -w @marko/language-core -w @marko/volar-language-server
npm run test -w @marko/volar-language-server
```

Review checkpoint:

- Inspect invalidation behavior around edits and project reloads.
- Verify no TypeScript private API dependency is added unless isolated and justified.
- Commit Stage 2 before starting Stage 3.

## Stage 3: Stabilize HTML Custom Data and Data Provider Caches

Scope: prevent `html-service.ts` and `data-provider.ts` from rebuilding providers and notifying listeners on every warmed feature request.

Expected files:

- `packages/volar-language-server/src/plugins/marko-template/html-service.ts`
- `packages/volar-language-server/src/plugins/marko-template/data-provider.ts`
- Possibly `packages/volar-language-server/src/plugins/marko-template/component-meta.ts`

Implementation notes:

- Replace object-identity comparison of request-local `componentMeta` sessions with a stable provider/cache identity.
- Keep one Marko data provider per unchanged root/context/component-meta backing cache.
- Move enriched tag-data caching away from `WeakMap<MarkoComponentMetaSession, ITagData[]>` if sessions can still be request-local. Key it by stable root plus stable metadata cache identity instead.
- Only call `onDidChangeCustomData` listeners when the effective provider data changes.
- Preserve lazy behavior: do not precompute all metadata during provider creation.

Acceptance criteria:

- Repeated warmed hover/completion/document symbol/document link requests for the same root/context do not rebuild HTML custom data.
- Listener notifications are not emitted for unchanged effective provider state.
- Tag documentation and attribute/value completion remain updated when metadata changes after an edit.

Likely tests:

```sh
npm run build -w @marko/component-meta -w @marko/language-core -w @marko/volar-language-server
npm run test -w @marko/volar-language-server
```

Review checkpoint:

- Confirm cached provider state cannot outlive the root/context in a way that leaks large documents.
- Confirm custom data updates still happen when a root is replaced by an edit.
- Commit Stage 3 before starting Stage 4.

## Stage 4: Make Component-Meta Checker Incremental

Scope: reduce checker rebuild cost by moving from repeated direct `ts.createProgram` rebuilds to a language-service-style incremental model, following the Vue blueprint.

Expected files:

- `packages/component-meta/src/lib/checker.ts`
- `packages/component-meta/src/lib/host.ts`
- Component-meta tests under `packages/component-meta/src/**/__tests__`
- Test bridge updates in `packages/volar-language-server/src/__tests__/util/language-service.ts`

Implementation notes:

- Prefer `ts.createLanguageService` over direct `ts.createProgram`, backed by script snapshots and per-file versions.
- Track a `projectVersion` or equivalent counter and increment it in `updateFile`, `deleteFile`, and `reload`.
- Keep `Project.clearCaches()` only where needed; avoid clearing all metadata for unrelated file edits if dependency tracking can stay simple and safe.
- If retaining `createProgram` temporarily, pass `oldProgram` and avoid clearing `programCache` more broadly than needed. Treat this as a fallback, not the preferred end state.
- Update the test bridge so it consults `componentMetaChecker` before calling the separate test `languageService.getProgram()` fallback.

Acceptance criteria:

- Repeated `getTagMeta` on unchanged files reuses the same underlying language service/program work.
- Updating a tag-like file changes metadata correctly and invalidates only necessary cache entries.
- The volar test bridge no longer pays `getProgram()` before checking the checker cache.
- Existing component-meta and volar-language-server tests pass.

Likely tests:

```sh
npm run build -w @marko/component-meta -w @marko/language-core -w @marko/volar-language-server
npm run test -w @marko/component-meta
npm run test -w @marko/volar-language-server
```

Review checkpoint:

- Review snapshot/version handling carefully for open, edited, closed, deleted, and disk-backed files.
- Confirm memory use remains bounded when files are opened and closed repeatedly.
- Commit Stage 4 before starting Stage 5.

## Stage 5: Narrow Metadata Preloading

Scope: reduce unnecessary metadata loads from `getRelevantTagNames` and definition/hover/completion paths.

Expected files:

- `packages/volar-language-server/src/plugins/marko-template/index.ts`
- `packages/volar-language-server/src/plugins/marko-template/definition.ts`
- `packages/volar-language-server/src/plugins/marko-template/hover.ts`
- `packages/volar-language-server/src/plugins/marko-template/util.ts`, if helpers need local adjustment.

Implementation notes:

- Prefer loading metadata for the concrete target tag when a target node is known.
- Avoid falling back to all non-HTML tags for contexts where source-only or native HTML behavior is enough.
- For open tag name completion, keep metadata lazy; do not preload all tags just to populate the completion list unless documentation requires it for visible items.
- Ensure definition only preloads owner tag metadata for attr-tags and the direct tag metadata for custom tags.

Acceptance criteria:

- Completion/hover/definition request paths load the smallest practical set of tag metadata.
- Request behavior remains correct for attr-tags, imported tags, custom tags, and native HTML tags.
- Warm p95 remains <= 50-60ms and cold paths do not regress substantially.

Likely tests:

```sh
npm run build -w @marko/component-meta -w @marko/language-core -w @marko/volar-language-server
npm run test -w @marko/volar-language-server
```

Review checkpoint:

- Inspect feature behavior manually or through fixtures for attr-tag hover/definition/completion.
- Confirm no path now depends on missing metadata because preload was narrowed too far.
- Commit Stage 5 before starting Stage 6.

## Stage 6: Perf Assertions and Bench Reporting

Scope: add practical reporting and guarded assertions after runtime optimizations are in place, so benchmarks measure the optimized architecture rather than locking in current slow behavior.

Expected files:

- `packages/volar-language-server/src/__perf__/*.test.ts`
- `packages/volar-language-server/package.json`, only if script ergonomics need adjustment.
- Optional lightweight test utilities under `packages/volar-language-server/src/__tests__/util`.

Implementation notes:

- Extend or add `npm run perf -w @marko/volar-language-server` coverage for warmed repeated hover, completion, and definition scenarios that use component metadata.
- Report p50, p95, max, and request counts for `_marko:getComponentMeta`.
- Add assertions with conservative thresholds to avoid flaky CI. If machine variance is high, assert request-count/cache behavior in tests and keep timing as reported output.
- Include at least one edit scenario proving cache invalidation after a tag-like file changes.

Acceptance criteria:

- Perf output makes it obvious whether warmed p95 is <= 50-60ms.
- Tests or perf assertions catch accidental repeated metadata extraction/re-request loops.
- Edit invalidation is covered.

Likely tests:

```sh
npm run build -w @marko/component-meta -w @marko/language-core -w @marko/volar-language-server
npm run perf -w @marko/volar-language-server
npm run test -w @marko/volar-language-server
```

Review checkpoint:

- Confirm assertions are stable locally and suitable for CI, or clearly marked reporting-only.
- Confirm benchmark fixtures are representative and not overly large for routine runs.
- Commit Stage 6 before final full verification.

## Final Verification

Run after all stages are committed:

```sh
npm run build -w @marko/component-meta -w @marko/language-core -w @marko/volar-language-server
npm run test -w @marko/component-meta
npm run test -w @marko/volar-language-server
npm run perf -w @marko/volar-language-server
npm run lint
```

Merge readiness criteria:

- Warmed metadata-backed hover/completion/definition p95 is <= 50-60ms in the perf report.
- Repeated warmed requests do not repeatedly request or extract identical component metadata.
- Cache invalidation after edits and closes is tested.
- Each stage exists as its own reviewed commit.
