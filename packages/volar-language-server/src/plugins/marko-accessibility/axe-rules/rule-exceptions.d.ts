import * as r from "./axe-rules";
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;
type AllRules = UnionToIntersection<(typeof r)[keyof typeof r]>;
type RuleId = AllRules[keyof AllRules];
export interface Exceptions {
  /**
   * Exclude if the listed attributes have a dynamic value
   */
  dynamicAttrs?: string[];
  /**
   * Exclude if the tag has a spread attribute
   */
  attrSpread?: boolean;
  /**
   * Exclude if the body content can't be determined
   */
  unknownBody?: boolean;
}
type Blacklist =
  | typeof r.structure.frameTested
  | typeof r.aria.ariaRequiredParent
  | typeof r.forms.label
  | typeof r.forms.labelTitleOnly
  | typeof r.forms.selectName
  | typeof r.keyboard.bypass
  | typeof r.keyboard.nestedInteractive
  | typeof r.keyboard.region
  | typeof r.semantics.headingOrder
  | typeof r.semantics.landmarkBannerIsTopLevel
  | typeof r.semantics.landmarkComplementaryIsTopLevel
  | typeof r.semantics.landmarkContentinfoIsTopLevel
  | typeof r.semantics.landmarkMainIsTopLevel
  | typeof r.semantics.landmarkOneMain
  | typeof r.semantics.pageHasHeadingOne
  | typeof r.structure.dlitem
  | typeof r.structure.listitem
  | typeof r.tables.tdHeadersAttr
  | typeof r.aria.ariaRoledescription
  | typeof r.aria.ariaValidAttr
  | typeof r.color.colorContrast
  | typeof r.color.colorContrastEnhanced
  | typeof r.color.linkInTextBlock
  | typeof r.keyboard.scrollableRegionFocusable
  | typeof r.parsing.duplicateId
  | typeof r.parsing.duplicateIdActive
  | typeof r.parsing.duplicateIdAria
  | typeof r.sensoryAndVisualCues.targetSize
  | typeof r.structure.avoidInlineSpacing
  | typeof r.aria.ariaValidAttrValue
  | typeof r.aria.ariaAllowedAttr
  | typeof r.structure.cssOrientationLock
  | typeof r.keyboard.focusOrderSemantics
  | typeof r.structure.hiddenContent
  | typeof r.semantics.labelContentNameMismatch
  | typeof r.semantics.pAsHeading
  | typeof r.tables.tableFakeCaption
  | typeof r.tables.tdHasHeader;
type Whitelist = Exclude<RuleId, Blacklist>;
export declare const ruleExceptions: {
  [id in Whitelist]: Exceptions;
};
export {};
