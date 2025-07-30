package com.markojs.intellij

import com.intellij.lang.ASTNode
import com.intellij.lang.PsiBuilder
import com.intellij.lang.PsiParser
import com.intellij.psi.tree.IElementType

/**
 * Minimal parser for Marko files.
 * This is a placeholder since actual parsing is handled by the LSP.
 */
class MarkoParser : PsiParser {
    
    override fun parse(root: IElementType, builder: PsiBuilder): ASTNode {
        val rootMarker = builder.mark()
        
        // Parse everything as a single text token
        while (!builder.eof()) {
            builder.advanceLexer()
        }
        
        rootMarker.done(root)
        return builder.treeBuilt
    }
}