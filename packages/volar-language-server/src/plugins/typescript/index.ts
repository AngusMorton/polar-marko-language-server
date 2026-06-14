import { MarkoVirtualCode } from "@marko/language-core";
import type {
  CompletionItem,
  LanguageServiceContext,
  LanguageServicePlugin,
  LanguageServicePluginInstance,
} from "@volar/language-server";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { URI } from "vscode-uri";

import {
  cleanMarkoCompletionItem,
  cleanMarkoDiagnostics,
  cleanMarkoHover,
  enhanceDiagnosticPositions,
} from "./diagnostic-enhancements";

// Filter out syntax errors from generated TS that are surfaced more accurately
// by the Marko compiler, matching the original language server behavior.
const IGNORE_DIAG_REG =
  /^(?:(?:Expression|Identifier|['"][^\w]['"]) expected|Invalid character)\b/i;

/**
 * Resolves the Marko source script + generated "script" embedded code behind an
 * embedded TypeScript document URI, or `undefined` when it isn't Marko-derived.
 */
function resolveMarkoScript(
  context: LanguageServiceContext,
  embeddedDocumentUri: string,
) {
  const decoded = context.decodeEmbeddedDocumentUri(
    URI.parse(embeddedDocumentUri),
  );
  const sourceScript = decoded && context.language.scripts.get(decoded[0]);
  const rootCode = sourceScript?.generated?.root;
  const scriptCode = sourceScript?.generated?.embeddedCodes.get("script");

  if (
    sourceScript &&
    rootCode instanceof MarkoVirtualCode &&
    scriptCode &&
    decoded?.[1] === "script"
  ) {
    return { sourceScript, scriptCode };
  }
}

export const create = (
  ts: typeof import("typescript"),
): LanguageServicePlugin[] => {
  const tsServicePlugins = createTypeScriptServices(
    ts as typeof import("typescript"),
    {},
  );
  return tsServicePlugins.map<LanguageServicePlugin>((plugin) => {
    if (plugin.name === "typescript-semantic") {
      return {
        ...plugin,
        create(context): LanguageServicePluginInstance {
          const typeScriptPlugin = plugin.create(context);
          return {
            ...typeScriptPlugin,
            async provideDiagnostics(document, token) {
              const diagnostics = await typeScriptPlugin.provideDiagnostics?.(
                document,
                token,
              );
              if (!diagnostics) return null;

              const marko = resolveMarkoScript(context, document.uri);
              if (marko) {
                const map = context.language.maps.get(
                  marko.scriptCode,
                  marko.sourceScript,
                );
                return cleanMarkoDiagnostics(
                  enhanceDiagnosticPositions(diagnostics, document, map).filter(
                    (diagnostic) => !IGNORE_DIAG_REG.test(diagnostic.message),
                  ),
                );
              }

              return diagnostics;
            },
            async provideHover(document, position, token) {
              const hover = await typeScriptPlugin.provideHover?.(
                document,
                position,
                token,
              );
              if (!hover) return hover;

              return resolveMarkoScript(context, document.uri)
                ? cleanMarkoHover(hover)
                : hover;
            },
            async resolveCompletionItem(item, token) {
              const resolved =
                (await typeScriptPlugin.resolveCompletionItem?.(item, token)) ??
                item;
              const embeddedUri = (
                resolved.data as { embeddedDocumentUri?: string } | undefined
              )?.embeddedDocumentUri;

              return embeddedUri && resolveMarkoScript(context, embeddedUri)
                ? cleanMarkoCompletionItem(resolved)
                : resolved;
            },
            transformCompletionItem(item: CompletionItem) {
              const data = item.data as
                | {
                    uri?: string;
                    embeddedDocumentUri?: string;
                  }
                | undefined;
              if (
                data?.embeddedDocumentUri?.includes(
                  "volar-embedded-content://script/",
                ) &&
                /^[A-Z][\w$]*$/.test(String(item.label))
              ) {
                item.kind = 7;
                item.sortText = `0${item.textEdit?.newText ?? item.insertText ?? item.label}`;
              }

              return item;
            },
          };
        },
      };
    }
    return plugin;
  });
};
