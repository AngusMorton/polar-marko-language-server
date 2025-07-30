package com.markojs.intellij

import com.intellij.ide.IconProvider
import com.intellij.openapi.util.IconLoader
import com.intellij.psi.PsiElement
import javax.swing.Icon

/**
 * Provides icons for Marko files and elements.
 */
class MarkoIconProvider : IconProvider() {
    
    companion object {
        private val MARKO_ICON = IconLoader.getIcon("/icons/marko.svg", MarkoIconProvider::class.java)
    }
    
    override fun getIcon(element: PsiElement, flags: Int): Icon? {
        return if (element is MarkoPsiFile) MARKO_ICON else null
    }
}