package com.markojs.intellij

import com.intellij.lang.ASTNode
import com.intellij.lang.ParserDefinition
import com.intellij.lang.PsiParser
import com.intellij.lexer.Lexer
import com.intellij.openapi.project.Project
import com.intellij.psi.FileViewProvider
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IFileElementType
import com.intellij.psi.tree.TokenSet

/**
 * Minimal parser definition for Marko files.
 * This is required for file type registration but actual parsing is handled by the LSP.
 */
class MarkoParserDefinition : ParserDefinition {
    
    companion object {
        private val FILE_ELEMENT_TYPE = IFileElementType(MarkoLanguage.INSTANCE)
    }
    
    override fun createLexer(project: Project?): Lexer {
        return MarkoLexer()
    }
    
    override fun createParser(project: Project?): PsiParser {
        return MarkoParser()
    }
    
    override fun getFileNodeType(): IFileElementType = FILE_ELEMENT_TYPE
    
    override fun getCommentTokens(): TokenSet = TokenSet.EMPTY
    
    override fun getStringLiteralElements(): TokenSet = TokenSet.EMPTY
    
    override fun createElement(node: ASTNode): PsiElement {
        return MarkoPsiElement(node)
    }
    
    override fun createFile(viewProvider: FileViewProvider): PsiFile {
        return MarkoPsiFile(viewProvider)
    }
}