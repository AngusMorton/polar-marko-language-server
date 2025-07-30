package com.markojs.intellij

import com.intellij.openapi.fileTypes.LanguageFileType
import com.intellij.openapi.util.IconLoader
import javax.swing.Icon

class MarkoFileType : LanguageFileType(MarkoLanguage.INSTANCE) {
    
    companion object {
        @JvmStatic
        val INSTANCE = MarkoFileType()
    }
    
    override fun getName(): String = "Marko"
    
    override fun getDescription(): String = "Marko template file"
    
    override fun getDefaultExtension(): String = "marko"
    
    override fun getIcon(): Icon = IconLoader.getIcon("/icons/marko.svg", MarkoFileType::class.java)
}