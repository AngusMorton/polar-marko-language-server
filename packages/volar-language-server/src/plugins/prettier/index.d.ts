import { Connection } from "@volar/language-server";
import type {
  FormattingOptions,
  LanguageServiceContext,
  LanguageServicePlugin,
} from "@volar/language-service";
import type { Options } from "prettier";
import * as markoPrettier from "prettier-plugin-marko";
export declare function createMarkoPrettierService(
  connection: Connection,
): LanguageServicePlugin;
export declare function getPrettierInstance(context: LanguageServiceContext): {
  prettierInstance?: typeof import("prettier");
  prettierPluginMarko?: typeof import("prettier-plugin-marko");
};
export declare function getFormattingOptions(
  prettierInstance: typeof import("prettier"),
  prettierPlugin: typeof markoPrettier,
  documentUriString: string,
  formatOptions: FormattingOptions,
  context: LanguageServiceContext,
  onError?: (message: string) => void,
): Promise<Options>;
