package com.markojs.intellij

import com.intellij.openapi.editor.DefaultLanguageHighlighterColors
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.psi.tree.IElementType

/**
 * Token types for Marko language.
 * This is minimal since actual parsing is handled by the LSP.
 */
object MarkoTokenTypes {
    
    @JvmStatic
    val TEXT = IElementType("MARKO_TEXT", MarkoLanguage.INSTANCE)
    
    @JvmStatic
    val TAG_NAME = IElementType("MARKO_TAG_NAME", MarkoLanguage.INSTANCE)
    
    @JvmStatic
    val ATTRIBUTE_NAME = IElementType("MARKO_ATTRIBUTE_NAME", MarkoLanguage.INSTANCE)
    
    @JvmStatic
    val ATTRIBUTE_VALUE = IElementType("MARKO_ATTRIBUTE_VALUE", MarkoLanguage.INSTANCE)
    
    @JvmStatic
    val COMMENT = IElementType("MARKO_COMMENT", MarkoLanguage.INSTANCE)
    
    @JvmStatic
    val PLACEHOLDER = IElementType("MARKO_PLACEHOLDER", MarkoLanguage.INSTANCE)
    
    // Text attribute keys for syntax highlighting
    val TAG_NAME_KEY = TextAttributesKey.createTextAttributesKey(
        "MARKO_TAG_NAME", 
        DefaultLanguageHighlighterColors.MARKUP_TAG
    )
    
    val ATTRIBUTE_NAME_KEY = TextAttributesKey.createTextAttributesKey(
        "MARKO_ATTRIBUTE_NAME", 
        DefaultLanguageHighlighterColors.MARKUP_ATTRIBUTE
    )
    
    val ATTRIBUTE_VALUE_KEY = TextAttributesKey.createTextAttributesKey(
        "MARKO_ATTRIBUTE_VALUE", 
        DefaultLanguageHighlighterColors.STRING
    )
    
    val COMMENT_KEY = TextAttributesKey.createTextAttributesKey(
        "MARKO_COMMENT", 
        DefaultLanguageHighlighterColors.BLOCK_COMMENT
    )
    
    val PLACEHOLDER_KEY = TextAttributesKey.createTextAttributesKey(
        "MARKO_PLACEHOLDER", 
        DefaultLanguageHighlighterColors.TEMPLATE_LANGUAGE_COLOR
    )
    
    val TEXT_KEY = TextAttributesKey.createTextAttributesKey(
        "MARKO_TEXT", 
        DefaultLanguageHighlighterColors.TEMPLATE_LANGUAGE_COLOR
    )
    
    fun getTokenHighlights(tokenType: IElementType): Array<TextAttributesKey> {
        return when (tokenType) {
            TAG_NAME -> arrayOf(TAG_NAME_KEY)
            ATTRIBUTE_NAME -> arrayOf(ATTRIBUTE_NAME_KEY)
            ATTRIBUTE_VALUE -> arrayOf(ATTRIBUTE_VALUE_KEY)
            COMMENT -> arrayOf(COMMENT_KEY)
            PLACEHOLDER -> arrayOf(PLACEHOLDER_KEY)
            TEXT -> arrayOf(TEXT_KEY)
            else -> emptyArray()
        }
    }
}