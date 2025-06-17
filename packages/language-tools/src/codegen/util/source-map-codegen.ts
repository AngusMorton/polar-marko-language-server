import { SourceMapGenerator } from "source-map-js";

import type { Parsed, Range } from "../../parser";

/**
 * Utility to build up generated code from source ranges while maintaining a source mapping using source-map-js.
 */
export class SourceMapCodegen {
  #parsed: Parsed;
  #generated = "";
  #sourceMap: SourceMapGenerator;

  constructor(parsed: Parsed) {
    this.#parsed = parsed;
    this.#sourceMap = new SourceMapGenerator({
      file: parsed.filename,
    });
    // Add the source content to the source map
    this.#sourceMap.setSourceContent(parsed.filename, parsed.code);
  }

  write(str: string) {
    this.#generated += str;
    return this;
  }

  copy(range: Range | string | false | void | undefined | null) {
    if (range) {
      if (typeof range === "string") {
        this.#generated += range;
      } else {
        const sourceText = this.#parsed.read(range);

        // Calculate generated position (line and column are 1-based in source-map-js)
        const generatedPos = this.#getGeneratedPosition(this.#generated.length);

        // Get source position (convert from 0-based to 1-based)
        const sourcePos = this.#parsed.positionAt(range.start);

        // Add mapping for the start of this segment
        this.#sourceMap.addMapping({
          generated: {
            line: generatedPos.line,
            column: generatedPos.column,
          },
          source: this.#parsed.filename,
          original: {
            line: sourcePos.line + 1, // Convert from 0-based to 1-based
            column: sourcePos.character,
          },
        });

        this.#generated += sourceText;
      }
    }
    return this;
  }

  end() {
    return {
      code: this.#generated,
      map: this.#sourceMap,
    };
  }

  /**
   * Convert character offset to line/column position for generated code
   */
  #getGeneratedPosition(offset: number): { line: number; column: number } {
    let line = 1;
    let column = 0;

    for (let i = 0; i < offset; i++) {
      if (this.#generated[i] === "\n") {
        line++;
        column = 0;
      } else {
        column++;
      }
    }

    return { line, column };
  }
}
