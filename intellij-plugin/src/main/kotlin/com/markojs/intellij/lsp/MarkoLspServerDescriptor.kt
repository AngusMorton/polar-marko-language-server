package com.markojs.intellij.lsp

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor
import com.intellij.openapi.diagnostic.logger
import com.intellij.openapi.application.PathManager
import com.intellij.openapi.application.ApplicationManager
import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import org.eclipse.lsp4j.InitializeParams
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
        LOG.info("MarkoLspServerDescriptor.createCommandLine() called for project: ${project.name}")
        
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
        
        val commandLine = GeneralCommandLine()
            .withExePath(nodeExecutable.absolutePath)
            .withParameters(languageServerScript.absolutePath, "--stdio")
            .withWorkDirectory(project.basePath)
        
        LOG.info("Created command line: ${commandLine.commandLineString}")
        return commandLine
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
        
        LOG.info("Base plugin path: $pluginPath")
        
        // Try different possible locations for ls-dist
        val possibleLsDistPaths = listOf(
            File(pluginPath, "lib/ls-dist"),
            File(pluginPath, "ls-dist"),
            File(pluginPath, "marko-intellij-plugin/lib/ls-dist")
        )
        
        for (lsDistPath in possibleLsDistPaths) {
            LOG.info("Checking ls-dist path: $lsDistPath")
            if (lsDistPath.exists()) {
                LOG.info("✓ Found bundled language server at: $lsDistPath")
                return lsDistPath
            }
        }
        
        // Debug: List contents of plugin directory
        if (pluginPath.exists()) {
            LOG.info("Plugin directory exists, contents:")
            pluginPath.listFiles()?.forEach { file ->
                LOG.info("  - ${file.name} (${if (file.isDirectory) "dir" else "file"})")
            }
            
            val libDir = File(pluginPath, "lib")
            if (libDir.exists()) {
                LOG.info("lib directory contents:")
                libDir.listFiles()?.forEach { file ->
                    LOG.info("  - lib/${file.name} (${if (file.isDirectory) "dir" else "file"})")
                }
            }
        } else {
            LOG.error("Plugin directory does not exist: $pluginPath")
        }
        
        throw RuntimeException("Bundled language server not found. Plugin path: $pluginPath. The plugin installation may be corrupted.")
    }
    
    private fun getPluginPath(): File {
        return try {            
            // Check common plugin locations
            val pluginsDir = PathManager.getPluginsPath()
            LOG.info("Plugins directory: $pluginsDir")
            
            val possiblePaths = listOf(
                File(pluginsDir, "marko-intellij-plugin"),
                File(pluginsDir, "Marko Language Support"),
                File(pluginsDir, "com.markojs.intellij-plugin")
            )
            
            for (path in possiblePaths) {
                LOG.info("Checking plugin path: $path")
                if (path.exists()) {
                    LOG.info("Found plugin at: $path")
                    return path
                }
            }
            
            // Fallback: Use default path
            LOG.warn("Plugin path not found, using default")
            File(pluginsDir, "marko-intellij-plugin")
            
        } catch (e: Exception) {
            LOG.error("Error getting plugin path", e)
            val pluginsDir = PathManager.getPluginsPath()
            File(pluginsDir, "marko-intellij-plugin")
        }
    }
    
    private fun getBundledNodeExecutable(lsDistPath: File): File {
        val nodeDir = File(lsDistPath, "node")
        
        if (nodeDir.exists()) {
            val possiblePaths = listOf(
                File(nodeDir, "bin/node"),
                File(nodeDir, "node.exe"), 
                File(nodeDir, "node")
            )
            
            for (path in possiblePaths) {
                if (path.exists() && isExecutableForCurrentPlatform(path)) {
                    LOG.info("Using bundled Node.js: $path")
                    return path
                }
            }
            
            LOG.warn("Bundled Node.js found but not compatible with current platform")
        }
        
        // Fallback to system Node.js
        LOG.info("Attempting to use system Node.js as fallback")
        val systemNode = findSystemNodeExecutable()
        if (systemNode != null) {
            LOG.info("Using system Node.js: $systemNode")
            showNodeFallbackNotification()
            return systemNode
        }
        
        throw RuntimeException("No compatible Node.js executable found. Please install Node.js or ensure the plugin is built for your platform.")
    }
    
    private fun isExecutableForCurrentPlatform(executable: File): Boolean {
        return try {
            // Try to run node --version to check if it's compatible
            val process = ProcessBuilder(executable.absolutePath, "--version")
                .redirectOutput(ProcessBuilder.Redirect.PIPE)
                .redirectError(ProcessBuilder.Redirect.PIPE)
                .start()
            
            val exitCode = process.waitFor()
            exitCode == 0
        } catch (e: Exception) {
            LOG.debug("Node.js executable not compatible: ${e.message}")
            false
        }
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
    
    override fun createInitializationOptions(): Any? {
        // The Marko language server requires typescript.tsdk initialization option
        val bundledTsPath = getBundledTypeScriptPath()
        
        return mapOf(
            "typescript" to mapOf(
                "tsdk" to bundledTsPath.absolutePath
            )
        )
    }
    
    private fun getBundledTypeScriptPath(): File {
        val lsDistPath = getBundledLanguageServerPath()
        val tsLib = File(lsDistPath, "node_modules/typescript/lib")
        
        if (tsLib.exists()) {
            LOG.info("Found bundled TypeScript at: $tsLib")
            return tsLib
        }
        
        // Fallback: try to find system TypeScript
        val systemTsLib = File("/usr/lib/node_modules/typescript/lib")
        if (systemTsLib.exists()) {
            LOG.info("Using system TypeScript at: $systemTsLib")
            return systemTsLib
        }
        
        // Last resort: use the bundled path even if it doesn't exist
        LOG.warn("TypeScript lib not found, using bundled path anyway: $tsLib")
        return tsLib
    }
    
    private fun showNodeFallbackNotification() {
        ApplicationManager.getApplication().invokeLater {
            try {
                val notificationGroup = NotificationGroupManager.getInstance()
                    .getNotificationGroup("Marko Plugin")
                
                val notification = notificationGroup.createNotification(
                    "Marko Language Support",
                    "Using system Node.js instead of bundled runtime. For optimal performance, please ensure Node.js v20+ is installed.",
                    NotificationType.INFORMATION
                )
                
                notification.notify(project)
                
            } catch (e: Exception) {
                LOG.error("Error showing Node.js fallback notification", e)
            }
        }
    }
}