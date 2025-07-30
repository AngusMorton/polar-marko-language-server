package com.markojs.intellij.lsp4ij

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.project.Project
import com.intellij.openapi.diagnostic.logger
import com.intellij.openapi.application.PathManager
import java.io.File

/**
 * Language Server Factory for LSP4IJ integration.
 * This provides Marko language server support for Community Edition IDEs via LSP4IJ.
 * 
 * Note: This class is designed to work with LSP4IJ plugin when available.
 * It does not inherit from LSP4IJ classes to avoid compilation dependencies.
 */
@Suppress("unused") // Used by LSP4IJ when available
class MarkoLanguageServerFactory {
    
    companion object {
        private val LOG = logger<MarkoLanguageServerFactory>()
    }
    
    /**
     * Creates command line for launching the Marko language server.
     * This method is called reflectively by LSP4IJ when available.
     */
    fun createCommandLine(project: Project): GeneralCommandLine {
        // Check if we're in test mode and should use mock server
        val useMockServer = System.getProperty("marko.test.mock.server") == "true"
        val mockServerPath = System.getProperty("marko.test.mock.server.path")
        
        if (useMockServer && mockServerPath != null) {
            LOG.info("LSP4IJ - Using mock language server for testing: $mockServerPath")
            return createMockServerCommandLine(project, mockServerPath)
        }
        
        val pluginPath = getPluginPath()
        val lsDistPath = File(pluginPath, "lib/ls-dist")
        
        LOG.info("LSP4IJ - Plugin path: $pluginPath")
        LOG.info("LSP4IJ - Language server dist path: $lsDistPath")
        
        if (!lsDistPath.exists()) {
            throw RuntimeException("Language server distribution not found at: $lsDistPath. Plugin may not be properly installed.")
        }
        
        val nodeExecutable = getBundledNodeExecutable(lsDistPath)
        val languageServerScript = getBundledLanguageServerScript(lsDistPath)
        
        LOG.info("LSP4IJ - Node executable: $nodeExecutable")
        LOG.info("LSP4IJ - Language server script: $languageServerScript")
        
        return GeneralCommandLine()
            .withExePath(nodeExecutable.absolutePath)
            .withParameters(languageServerScript.absolutePath, "--stdio")
            .withWorkDirectory(project.basePath)
    }
    
    override fun toString(): String = "Marko Language Server"
    
    private fun createMockServerCommandLine(project: Project, mockServerPath: String): GeneralCommandLine {
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
    
    private fun getPluginPath(): File {
        // Check for test-specific plugin path override
        val testPluginPath = System.getProperty("marko.test.plugin.path")
        if (testPluginPath != null) {
            return File(testPluginPath)
        }
        
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
        
        val possibleScripts = listOf(
            File(languageServerDir, "bin.js"),
            File(languageServerDir, "dist/bin.js"),
            File(languageServerDir, "lib/bin.js")
        )
        
        for (script in possibleScripts) {
            if (script.exists()) {
                return script
            }
        }
        
        throw RuntimeException("Marko language server entry script not found in: $languageServerDir")
    }
}