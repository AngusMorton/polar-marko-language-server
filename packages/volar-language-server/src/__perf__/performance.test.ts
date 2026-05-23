import assert from "node:assert/strict";

import type {} from "mocha";
import path from "path";
import { performance } from "perf_hooks";
import { Position } from "vscode-languageserver-protocol/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import {
  getComponentMetaCacheVersion,
  getComponentMetaRequests,
  getLanguageServer,
  resetComponentMetaRequests,
  shutdownLanguageServer,
} from "../__tests__/util/language-service";

const FIXTURE_DIR = path.join(__dirname, "../__tests__/fixtures");
const ITERATIONS = Number(process.env.MARKO_PERF_ITERATIONS ?? 30);
const WARMUP_ITERATIONS = Number(process.env.MARKO_PERF_WARMUP ?? 5);
const MAX_P95 = process.env.MARKO_PERF_MAX_P95_MS
  ? Number(process.env.MARKO_PERF_MAX_P95_MS)
  : undefined;

type Scenario = {
  name: string;
  fileName: string;
  source: string;
  run(uri: string, position: Position): Promise<unknown>;
  validate(result: unknown): void;
  expectWarmMetaRequests?: number;
};

describe("marko-template performance", () => {
  after(shutdownLanguageServer);

  it("measures repeated LSP feature requests", async () => {
    const server = await getLanguageServer();
    const scenarios: Scenario[] = [
      {
        name: "custom-tag-hover",
        fileName: fixturePath("script", "tags-api-basic", "index.marko"),
        source: "<fancy-button█ />",
        run: (uri, position) => server.sendHoverRequest(uri, position),
        validate(result) {
          assert(result, "Expected hover result");
        },
        expectWarmMetaRequests: 0,
      },
      {
        name: "custom-input-completion",
        fileName: fixturePath("script", "tags-api-basic", "index.marko"),
        source: "<fancy-button mess█/>",
        run: (uri, position) => server.sendCompletionRequest(uri, position),
        validate(result) {
          assert(
            (result as { items?: unknown[] } | undefined)?.items?.length,
            "Expected completion items",
          );
        },
        expectWarmMetaRequests: 0,
      },
      {
        name: "custom-input-completion-after-edit",
        fileName: fixturePath("script", "tags-api-basic", "index.marko"),
        source: "<fancy-button mess█/>",
        async run(uri, position) {
          await server.updateTextDocument(uri, [
            {
              range: {
                start: Position.create(0, 0),
                end: Position.create(0, 0),
              },
              newText: "\n",
            },
          ]);
          await server.updateTextDocument(uri, [
            {
              range: {
                start: Position.create(0, 0),
                end: Position.create(1, 0),
              },
              newText: "",
            },
          ]);
          return server.sendCompletionRequest(uri, position);
        },
        validate(result) {
          assert(
            (result as { items?: unknown[] } | undefined)?.items?.length,
            "Expected completion items",
          );
        },
        expectWarmMetaRequests: 0,
      },
      {
        name: "native-attr-completion",
        fileName: fixturePath("script", "basic", "index.marko"),
        source: "<div cla█/>",
        run: (uri, position) => server.sendCompletionRequest(uri, position),
        validate(result) {
          assert(
            (result as { items?: unknown[] } | undefined)?.items?.length,
            "Expected completion items",
          );
        },
      },
      {
        name: "custom-tag-definition",
        fileName: fixturePath("script", "class-api-basic", "index.marko"),
        source: [
          'import FancyButton from "<fancy-button>";',
          "<fancy-button█ />",
        ].join("\n"),
        run: (uri, position) => server.sendDefinitionRequest(uri, position),
        validate(result) {
          assert(
            (result as unknown[] | undefined)?.length,
            "Expected definition result",
          );
        },
        expectWarmMetaRequests: 0,
      },
    ];

    const rows = [];
    for (const scenario of scenarios) {
      rows.push(await measureScenario(scenario));
    }

    console.table(rows);
  });

  it("re-requests component metadata after a tag file edit", async () => {
    const server = await getLanguageServer();
    const componentFileName = fixturePath(
      "script",
      "tags-api-basic",
      "components",
      "fancy-button",
      "index.marko",
    );
    const componentUri = URI.file(componentFileName).toString();
    const componentSource = await server.openTextDocument(
      componentFileName,
      "marko",
    );
    const { content, position, uri } = getDocumentState(
      fixturePath("script", "tags-api-basic", "index.marko"),
      "<fancy-button mess█/>",
    );

    await server.openInMemoryDocument(uri, "marko", content);

    try {
      await server.sendCompletionRequest(uri, position);
      const previousVersion = getComponentMetaCacheVersion();
      resetComponentMetaRequests();
      await server.sendCompletionRequest(uri, position);
      assert.equal(
        getComponentMetaRequests().length,
        0,
        "Expected warmed metadata to be reused before editing",
      );

      await server.updateTextDocument(componentUri, [
        {
          range: {
            start: Position.create(1, 0),
            end: Position.create(1, 0),
          },
          newText: "// perf metadata edit\n",
        },
      ]);
      assert(
        getComponentMetaCacheVersion() > previousVersion,
        "Expected component metadata cache version to advance after editing a tag file",
      );

      resetComponentMetaRequests();
      const completion = await server.sendCompletionRequest(uri, position);
      assert(
        (completion as { items?: unknown[] } | undefined)?.items?.length,
        "Expected completion items after editing component metadata",
      );
      assert.equal(
        getComponentMetaRequests().length,
        1,
        "Expected metadata to be requested once after tag file edit",
      );
    } finally {
      await server.closeTextDocument(uri);
      await server.openInMemoryDocument(
        componentUri,
        "marko",
        componentSource.getText(),
      );
      await server.closeTextDocument(componentUri);
    }
  });
});

async function measureScenario(scenario: Scenario) {
  const server = await getLanguageServer();
  const { content, position, uri } = getDocumentState(
    scenario.fileName,
    scenario.source,
  );

  await server.openInMemoryDocument(uri, "marko", content);

  try {
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      scenario.validate(await scenario.run(uri, position));
    }

    resetComponentMetaRequests();
    const samples: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      scenario.validate(await scenario.run(uri, position));
      samples.push(performance.now() - start);
    }

    samples.sort((a, b) => a - b);
    const p95 = percentile(samples, 0.95);
    if (MAX_P95 !== undefined) {
      assert(
        p95 <= MAX_P95,
        `${scenario.name} p95 ${p95.toFixed(2)}ms exceeded ${MAX_P95}ms`,
      );
    }

    const metaRequests = getComponentMetaRequests().length;
    if (scenario.expectWarmMetaRequests !== undefined) {
      assert.equal(
        metaRequests,
        scenario.expectWarmMetaRequests,
        `${scenario.name} sent ${metaRequests} warmed component metadata requests`,
      );
    }

    return {
      scenario: scenario.name,
      iterations: ITERATIONS,
      meta_requests: metaRequests,
      meta_requests_per_iteration: round(metaRequests / ITERATIONS),
      min_ms: round(samples[0] ?? 0),
      median_ms: round(percentile(samples, 0.5)),
      p95_ms: round(p95),
      max_ms: round(samples[samples.length - 1] ?? 0),
      mean_ms: round(
        samples.reduce((sum, value) => sum + value, 0) / samples.length,
      ),
    };
  } finally {
    await server.closeTextDocument(uri);
  }
}

function getDocumentState(fileName: string, sourceWithCursor: string) {
  const cursorIndex = sourceWithCursor.indexOf("█");
  assert.notEqual(cursorIndex, -1, "Missing cursor marker");

  const content = sourceWithCursor.replace("█", "");
  const uri = URI.file(fileName).toString();
  const document = TextDocument.create(uri, "marko", 0, content);
  const cursorPosition = document.positionAt(cursorIndex);

  return {
    content,
    uri,
    position: Position.create(cursorPosition.line, cursorPosition.character),
  };
}

function fixturePath(...segments: string[]) {
  return path.join(FIXTURE_DIR, ...segments);
}

function percentile(samples: number[], percentile: number) {
  assert(samples.length, "Expected at least one sample");
  return samples[
    Math.min(samples.length - 1, Math.floor(samples.length * percentile))
  ]!;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
