import { type Node, NodeType, Parsed, Range } from "../../parser";
import { SourceMapCodegen } from "../util/source-map-codegen";
import {
  AttributeValueType,
  getAttributeValueType,
  isHTMLTag,
} from "./keywords";

export function extractHTML(parsed: Parsed) {
  return new HTMLExtractor(parsed).end();
}

class HTMLExtractor {
  #codegen: SourceMapCodegen;
  #read: Parsed["read"];
  #nodeDetails: {
    [id: string]: { hasDynamicAttrs: boolean; hasDynamicBody: boolean };
  };
  #nodeIdCounter: number;

  constructor(parsed: Parsed) {
    this.#codegen = new SourceMapCodegen(parsed);
    this.#read = parsed.read.bind(parsed);
    this.#nodeDetails = {};
    this.#nodeIdCounter = 0;
    parsed.program.body.forEach((node) => this.#visitNode(node));
  }

  end() {
    const result = this.#codegen.end();
    return {
      code: result.code,
      map: result.map,
      nodeDetails: this.#nodeDetails,
    };
  }

  #visitNode(node: Node.ChildNode) {
    let hasDynamicBody = false,
      hasDynamicAttrs = false,
      isDynamic = false;
    switch (node.type) {
      case NodeType.AttrTag:
        node.body?.forEach((child) => {
          if (this.#visitNode(child)) hasDynamicBody = true;
        });
        break;
      case NodeType.Tag: {
        if (node.nameText === "script" || node.nameText === "style") {
          break;
        }
        const nodeId = `${this.#nodeIdCounter++}`;
        ({ isDynamic, hasDynamicAttrs, hasDynamicBody } = this.#writeTag(
          node,
          nodeId,
        ));
        this.#nodeDetails[nodeId] = { hasDynamicAttrs, hasDynamicBody };
        break;
      }
      case NodeType.Text:
        this.#codegen.copy(node);
        break;
      case NodeType.Placeholder:
        isDynamic =
          this.#read({
            start: node.start + 1,
            end: node.start + 2,
          }) === "!";
        this.#codegen.write("placeholder");
        break;
    }

    return isDynamic || hasDynamicBody;
  }

  #writeTag(node: Node.Tag, id: string) {
    const isDynamic = !node.nameText || !isHTMLTag(node.nameText);
    let hasDynamicAttrs = false,
      hasDynamicBody = false;
    if (isDynamic) {
      this.#writeCustomTag(node);
    } else {
      ({ hasDynamicAttrs, hasDynamicBody } = this.#writeHTMLTag(node, id));
    }
    return { isDynamic, hasDynamicAttrs, hasDynamicBody };
  }

  #writeHTMLTag(node: Node.Tag, id: string) {
    let hasDynamicAttrs = false,
      hasDynamicBody = false;
    // <[node name]
    this.#codegen.write("<");
    this.#codegen.copy(isEmptyRange(node.name) ? node.nameText : node.name);

    this.#codegen.write(` data-marko-node-id="${id}"`);
    // [node attributes]
    node.attrs?.forEach((attr) => {
      if (attr.type === NodeType.AttrNamed) this.#writeAttrNamed(attr);
      else if (attr.type === NodeType.AttrSpread) hasDynamicAttrs = true;
    });
    // [body or self-closing `/`]
    this.#codegen.write(">");

    if (!isVoidTag(node.nameText)) {
      node.body?.forEach((child) => {
        if (this.#visitNode(child)) hasDynamicBody = true;
      });
      this.#codegen.write(`</${node.nameText}>`);
    }

    return { hasDynamicAttrs, hasDynamicBody };
  }

  #writeCustomTag(node: Node.Tag) {
    if (node.body) {
      // Replace all unknown and undefined tag names with `div`s
      this.#codegen.write("<div>");
      node.body.forEach((node) => this.#visitNode(node));
      this.#codegen.write("</div>");
    }
  }

  #writeAttrNamed(attr: Node.AttrNamed) {
    this.#codegen.write(" ");
    const nameString = this.#read(attr.name);
    if (/:(?:scoped|(?:no-update(?:-if)?))$/.test(nameString)) {
      this.#codegen.copy({
        start: attr.name.start,
        end: attr.name.start + nameString.lastIndexOf(":"),
      });
    } else {
      this.#codegen.copy(attr.name);
    }

    if (
      attr.value === undefined ||
      attr.name.start === attr.name.end ||
      attr.value.type === NodeType.AttrMethod
    ) {
      return;
    }

    const valueString = this.#read(attr.value);
    const valueType = getAttributeValueType(valueString);
    if (valueType === undefined) return;
    switch (valueType) {
      case AttributeValueType.True:
        break;
      case AttributeValueType.Literal:
        this.#codegen.write('="');
        this.#codegen.copy({
          start: attr.value.start + valueString.search(/[^=\s]/g),
          end: attr.value.end,
        });
        this.#codegen.write('"');
        break;
      case AttributeValueType.QuotedString:
        this.#codegen.write('="');
        this.#codegen.copy({
          start: attr.value.start + valueString.search(/[^=\s]/g) + 1,
          end: attr.value.end - 1,
        });
        this.#codegen.write('"');
        break;
      case AttributeValueType.Dynamic:
        // Replace all dynamic values with the string "dynamic" with a counter instead of removing them
        // Subject to change-- axe-core might require "true" for aria attributes or something
        this.#codegen.write(`="dynamic"`);
        break;
    }
  }
}

function isVoidTag(tagName: string | undefined) {
  switch (tagName) {
    case "area":
    case "base":
    case "br":
    case "col":
    case "embed":
    case "hr":
    case "img":
    case "input":
    case "link":
    case "meta":
    case "param":
    case "source":
    case "track":
    case "wbr":
      return true;
    default:
      return false;
  }
}

function isEmptyRange(range: Range) {
  return range.start === range.end;
}
