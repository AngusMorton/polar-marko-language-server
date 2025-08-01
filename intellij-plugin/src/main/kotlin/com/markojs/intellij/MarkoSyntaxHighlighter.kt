package com.markojs.intellij

import com.intellij.openapi.fileTypes.SyntaxHighlighter
import com.intellij.openapi.fileTypes.SyntaxHighlighterFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile

/**
 * Syntax highlighter factory for Marko files.
 * TextMate highlighting is now provided via the bundleProvider extension point.
 * This factory provides a minimal fallback when TextMate is not available.
 */
class MarkoSyntaxHighlighterFactory : SyntaxHighlighterFactory() {
    override fun getSyntaxHighlighter(project: Project?, virtualFile: VirtualFile?): SyntaxHighlighter {
        // TextMate highlighting is handled by the bundle provider extension point
        // This provides a minimal fallback highlighter
        return NoOpSyntaxHighlighter()
    }
}

/**
 * No-op syntax highlighter that provides no highlighting.
 * Used when TextMate is not available.
 */
class NoOpSyntaxHighlighter : SyntaxHighlighter {
    override fun getHighlightingLexer() = MarkoLexer()
    
    override fun getTokenHighlights(tokenType: com.intellij.psi.tree.IElementType) = 
        emptyArray<com.intellij.openapi.editor.colors.TextAttributesKey>()
}