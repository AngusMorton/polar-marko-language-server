package com.markojs.intellij.lsp

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor

/**
 * LSP Server Support Provider for Marko language using the native IntelliJ Platform LSP API.
 * This is used in Ultimate/Commercial editions that have native LSP support.
 */
class MarkoLspServerSupportProvider : LspServerSupportProvider {
    
    override fun fileOpened(project: Project, file: VirtualFile, serverStarter: LspServerSupportProvider.LspServerStarter) {
        if (file.extension == "marko") {
            serverStarter.ensureServerStarted(MarkoLspServerDescriptor(project))
        }
    }
}