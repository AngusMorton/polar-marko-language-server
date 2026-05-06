import type { TagDefinition } from "@marko/compiler/babel-utils";
import type { CompletionItem, Range } from "vscode-languageserver";
export default function getTagNameCompletion({
  tag,
  range,
  showAutoComplete,
  importer,
}: {
  tag: TagDefinition;
  range?: Range;
  importer?: string;
  showAutoComplete?: true;
}): CompletionItem;
