package com.markojs.intellij.lsp

import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor
// import com.intellij.platform.lsp.api.customization.LspSemanticTokensSupport // Not available in this IntelliJ version
import com.intellij.openapi.diagnostic.logger
import com.markojs.intellij.MarkoFileType

/**
 * LSP Server Support Provider for Marko language using the native IntelliJ Platform LSP API.
 * This is used in Ultimate/Commercial editions that have native LSP support.
 * 
 * Provides semantic token support when available from the language server.
 */
class MarkoLspServerSupportProvider : LspServerSupportProvider {
    
    companion object {
        private val LOG = logger<MarkoLspServerSupportProvider>()
    }
    
    override fun fileOpened(project: Project, file: VirtualFile, serverStarter: LspServerSupportProvider.LspServerStarter) {
        LOG.info("MarkoLspServerSupportProvider.fileOpened called for file: ${file.name}, extension: ${file.extension}")
        
        if (file.extension == "marko") {
            LOG.info("Starting Marko LSP server for project: ${project.name}")
            val descriptor = MarkoLspServerDescriptor(project)
            serverStarter.ensureServerStarted(descriptor)
            LOG.info("LSP server start requested")
        } else {
            LOG.info("File is not a .marko file, skipping LSP server startup")
        }
    }
    
    fun getServerDescriptor(project: Project, file: VirtualFile): ProjectWideLspServerDescriptor? {
        return if (file.extension == "marko") {
            MarkoLspServerDescriptor(project)
        } else {
            null
        }
    }
}

// LSP semantic tokens support removed - using TextMate only for syntax highlighting