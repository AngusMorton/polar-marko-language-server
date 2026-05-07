import type {
  LanguageServicePlugin,
  LanguageServicePluginInstance,
} from "@volar/language-server";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { URI } from "vscode-uri";

import { MarkoVirtualCode } from "../../language";
import { enhanceDiagnosticPositions } from "./diagnostic-enhancements";

// Filter out syntax errors from generated TS that are surfaced more accurately
// by the Marko compiler, matching the original language server behavior.
const IGNORE_DIAG_REG =
  /^(?:(?:Expression|Identifier|['"][^\w]['"]) expected|Invalid character)\b/i;

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

              const decoded = context.decodeEmbeddedDocumentUri(
                URI.parse(document.uri),
              );
              const sourceScript =
                decoded && context.language.scripts.get(decoded[0]);
              const rootCode = sourceScript?.generated?.root;
              const scriptCode =
                sourceScript?.generated?.embeddedCodes.get("script");

              if (rootCode instanceof MarkoVirtualCode && scriptCode) {
                return enhanceDiagnosticPositions(
                  diagnostics,
                  document,
                  scriptCode.mappings,
                ).filter(
                  (diagnostic) => !IGNORE_DIAG_REG.test(diagnostic.message),
                );
              }
            },
          };
        },
      };
    }
    return plugin;
  });
};
