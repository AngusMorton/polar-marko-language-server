package com.markojs.intellij

import com.intellij.lexer.LexerBase
import com.intellij.psi.tree.IElementType

/**
 * Minimal lexer for Marko files.
 * This is a placeholder since actual lexing is handled by the LSP.
 */
class MarkoLexer : LexerBase() {
    
    private var buffer: CharSequence? = null
    private var startOffset: Int = 0
    private var endOffset: Int = 0
    private var currentOffset: Int = 0
    
    override fun start(buffer: CharSequence, startOffset: Int, endOffset: Int, initialState: Int) {
        this.buffer = buffer
        this.startOffset = startOffset
        this.endOffset = endOffset
        this.currentOffset = startOffset
    }
    
    override fun getState(): Int = 0
    
    override fun getTokenType(): IElementType? {
        return if (currentOffset >= endOffset) null else MarkoTokenTypes.TEXT
    }
    
    override fun getTokenStart(): Int = currentOffset
    
    override fun getTokenEnd(): Int = endOffset
    
    override fun advance() {
        currentOffset = endOffset
    }
    
    override fun getBufferSequence(): CharSequence = buffer ?: ""
    
    override fun getBufferEnd(): Int = endOffset
}