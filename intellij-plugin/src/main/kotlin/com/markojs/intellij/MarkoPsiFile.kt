package com.markojs.intellij

import com.intellij.extapi.psi.PsiFileBase
import com.intellij.openapi.fileTypes.FileType
import com.intellij.psi.FileViewProvider

/**
 * PSI file representation for Marko files.
 */
class MarkoPsiFile(viewProvider: FileViewProvider) : PsiFileBase(viewProvider, MarkoLanguage.INSTANCE) {
    
    override fun getFileType(): FileType = MarkoFileType.INSTANCE
    
    override fun toString(): String = "Marko File"
}