package com.markojs.intellij

import com.intellij.extapi.psi.ASTWrapperPsiElement
import com.intellij.lang.ASTNode

/**
 * Base PSI element for Marko language.
 */
class MarkoPsiElement(node: ASTNode) : ASTWrapperPsiElement(node)