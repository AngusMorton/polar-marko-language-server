package com.markojs.intellij.lsp

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor
import com.intellij.openapi.diagnostic.logger
import com.intellij.openapi.application.PathManager
import java.io.File

/**
 * LSP Server Descriptor for Marko language server.
 * This handles the lifecycle and configuration of the language server process.
 */
open class MarkoLspServerDescriptor(project: Project) : ProjectWideLspServerDescriptor(project, "Marko") {
    
    companion object {
        private val LOG = logger<MarkoLspServerDescriptor>()
    }
    
    override fun isSupportedFile(file: VirtualFile): Boolean {
        return file.extension == "marko"
    }
    
    override fun createCommandLine(): GeneralCommandLine {
        // Check if we're in test mode and should use mock server
        val useMockServer = System.getProperty("marko.test.mock.server") == "true"
        val mockServerPath = System.getProperty("marko.test.mock.server.path")
        
        if (useMockServer && mockServerPath != null) {
            LOG.info("Using mock language server for testing: $mockServerPath")
            return createMockServerCommandLine(mockServerPath)
        }
        
        val lsDistPath = getBundledLanguageServerPath()
        
        LOG.info("Language server dist path: $lsDistPath")
        
        if (!lsDistPath.exists()) {
            throw RuntimeException("Language server distribution not found at: $lsDistPath. Plugin may not be properly installed.")
        }
        
        val nodeExecutable = getBundledNodeExecutable(lsDistPath)
        val languageServerScript = getBundledLanguageServerScript(lsDistPath)
        
        LOG.info("Node executable: $nodeExecutable")
        LOG.info("Language server script: $languageServerScript")
        
        return GeneralCommandLine()
            .withExePath(nodeExecutable.absolutePath)
            .withParameters(languageServerScript.absolutePath, "--stdio")
            .withWorkDirectory(project.basePath)
    }
    
    private fun createMockServerCommandLine(mockServerPath: String): GeneralCommandLine {
        val mockScript = File(mockServerPath)
        if (!mockScript.exists()) {
            throw RuntimeException("Mock language server script not found: $mockServerPath")
        }
        
        // Use system node for mock server (tests assume it's available)
        val nodeExecutable = findSystemNodeExecutable()
            ?: throw RuntimeException("Node.js not found in PATH. Required for running mock language server in tests.")
        
        return GeneralCommandLine()
            .withExePath(nodeExecutable.absolutePath)
            .withParameters(mockScript.absolutePath, "--stdio")
            .withWorkDirectory(project.basePath)
    }
    
    private fun findSystemNodeExecutable(): File? {
        val possibleCommands = if (System.getProperty("os.name").lowercase().contains("windows")) {
            listOf("node.exe", "node.cmd", "node")
        } else {
            listOf("node")
        }
        
        val pathDirs = System.getenv("PATH")?.split(File.pathSeparator) ?: emptyList()
        
        for (command in possibleCommands) {
            for (pathDir in pathDirs) {
                val executable = File(pathDir, command)
                if (executable.exists() && executable.canExecute()) {
                    return executable
                }
            }
        }
        
        return null
    }
    
    private fun getBundledLanguageServerPath(): File {
        // Check for test-specific plugin path override
        val testPluginPath = System.getProperty("marko.test.plugin.path")
        val pluginPath = if (testPluginPath != null) File(testPluginPath) else getPluginPath()
        val lsDistPath = File(pluginPath, "lib/ls-dist")
        
        if (lsDistPath.exists()) {
            LOG.info("Using bundled language server at: $lsDistPath")
            return lsDistPath
        }
        
        throw RuntimeException("Bundled language server not found. The plugin installation may be corrupted.")
    }
    
    private fun getPluginPath(): File {
        val pluginsPath = PathManager.getPluginsPath()
        return File(pluginsPath, "marko-intellij-plugin")
    }
    
    private fun getBundledNodeExecutable(lsDistPath: File): File {
        val nodeDir = File(lsDistPath, "node")
        if (!nodeDir.exists()) {
            throw RuntimeException("Bundled Node.js runtime not found at: $nodeDir")
        }
        
        val possiblePaths = listOf(
            File(nodeDir, "bin/node"),
            File(nodeDir, "node.exe"), 
            File(nodeDir, "node")
        )
        
        for (path in possiblePaths) {
            if (path.exists() && path.canExecute()) {
                return path
            }
        }
        
        throw RuntimeException("Node.js executable not found in bundled runtime: $nodeDir")
    }
    
    
    private fun getBundledLanguageServerScript(lsDistPath: File): File {
        val nodeModulesDir = File(lsDistPath, "node_modules")
        if (!nodeModulesDir.exists()) {
            throw RuntimeException("Bundled node_modules not found at: $nodeModulesDir")
        }
        
        val languageServerDir = File(nodeModulesDir, "@marko/language-server")
        if (!languageServerDir.exists()) {
            throw RuntimeException("@marko/language-server package not found in bundled dependencies")
        }
        
        val script = findScriptInDirectory(languageServerDir)
        if (script != null) {
            return script
        }
        
        throw RuntimeException("Marko language server entry script not found in: $languageServerDir")
    }
    
    private fun findScriptInDirectory(languageServerDir: File): File? {
        if (!languageServerDir.exists()) return null
        
        val possibleScripts = listOf(
            File(languageServerDir, "bin.js"),
            File(languageServerDir, "dist/bin.js"),
            File(languageServerDir, "lib/bin.js")
        )
        
        return possibleScripts.find { it.exists() }
    }
    
    
}