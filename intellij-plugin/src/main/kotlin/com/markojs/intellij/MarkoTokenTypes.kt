package com.markojs.intellij

import com.intellij.psi.tree.IElementType

/**
 * Token types for Marko language.
 * This is minimal since actual parsing is handled by the LSP.
 */
object MarkoTokenTypes {
    
    @JvmStatic
    val TEXT = IElementType("MARKO_TEXT", MarkoLanguage.INSTANCE)
}