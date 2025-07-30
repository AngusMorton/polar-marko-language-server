package com.markojs.intellij

import com.intellij.lang.Language

class MarkoLanguage : Language("Marko") {
    
    companion object {
        @JvmStatic
        val INSTANCE = MarkoLanguage()
    }
    
    override fun getDisplayName(): String = "Marko"
    
    override fun isCaseSensitive(): Boolean = true
}