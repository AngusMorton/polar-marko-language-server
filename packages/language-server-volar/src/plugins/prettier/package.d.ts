import type * as prettier from "prettier";
import type * as prettierPluginMarko from "prettier-plugin-marko";
export declare function importPrettier(
  fromPath: string,
): typeof prettier | undefined;
export declare function importMarkoPrettierPlugin(
  fromPath: string,
): typeof prettierPluginMarko | undefined;
