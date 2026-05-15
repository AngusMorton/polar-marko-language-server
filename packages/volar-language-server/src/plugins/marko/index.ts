import type {
  LanguageServicePlugin,
  LanguageServicePluginInstance,
} from "@volar/language-service";
import { TextDocument } from "vscode-languageserver-textdocument";
import { URI } from "vscode-uri";

import { MarkoVirtualCode } from "../../language";
import { provideValidations } from "./validate";
// import { provideDocumentSymbols } from "./document-symbols";

export const create = (
  _: typeof import("typescript"),
): LanguageServicePlugin => {
  return {
    name: "marko",
    capabilities: {
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create(context): LanguageServicePluginInstance {
      return {
        // TODO: Is this necessary?
        // provideDocumentSymbols(document, token) {
        //   if (token.isCancellationRequested) return;
        //   return worker(document, (virtualCode) => {
        //     return provideDocumentSymbols(virtualCode);
        //   });
        // },
        provideDiagnostics(document, token) {
          if (token.isCancellationRequested) return;
          return worker(document, async (virtualCode) => {
            return await provideValidations(virtualCode);
          });
        },
      };

      function worker<T>(
        document: TextDocument,
        callback: (markoDocument: MarkoVirtualCode) => T,
      ): T | undefined {
        const decoded = context.decodeEmbeddedDocumentUri(
          URI.parse(document.uri),
        );
        const sourceScript =
          decoded && context.language.scripts.get(decoded[0]);
        const virtualCode =
          decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
        if (!(virtualCode instanceof MarkoVirtualCode)) return;

        return callback(virtualCode);
      }
    },
  };
};
