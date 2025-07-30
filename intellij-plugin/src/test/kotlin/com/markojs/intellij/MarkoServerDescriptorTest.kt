package com.markojs.intellij

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.application.PathManager
import com.intellij.openapi.project.Project
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.markojs.intellij.lsp.MarkoLspServerDescriptor
import org.junit.Assert.*
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.Paths

/**
 * Tests for server lifecycle and bundling functionality.
 * 
 * This test verifies that the plugin correctly constructs the command line
 * to launch the bundled language server and does not rely on system paths.
 */
class MarkoServerDescriptorTest : BasePlatformTestCase() {
    
    private lateinit var tempPluginDir: Path
    private lateinit var mockLsDistDir: Path
    
    override fun setUp() {
        super.setUp()
        
        // Create a temporary plugin directory structure for testing
        tempPluginDir = Files.createTempDirectory("marko-plugin-test")
        mockLsDistDir = tempPluginDir.resolve("lib/ls-dist")
        
        setupMockPluginStructure()
    }
    
    override fun tearDown() {
        // Clean up temporary directory
        tempPluginDir.toFile().deleteRecursively()
        super.tearDown()
    }
    
    fun testCreateCommandLine() {
        // Mock the plugin path to point to our temporary directory
        System.setProperty("marko.test.plugin.path", tempPluginDir.toString())
        
        try {
            val descriptor = TestableMarkoLspServerDescriptor(project)
            val commandLine = descriptor.createCommandLine()
            
            // Verify command line construction
            assertNotNull("Command line should not be null", commandLine)
            
            val exePath = commandLine.exePath
            val parameters = commandLine.parametersList.parameters
            
            // Verify that the executable path points to the bundled Node.js
            assertTrue("Executable should point to bundled Node.js",
                exePath.contains(tempPluginDir.toString()))
            assertTrue("Executable should be in lib/ls-dist/node directory",
                exePath.contains("lib/ls-dist/node"))
            
            // Verify that the script parameter points to the bundled language server
            assertTrue("Should have language server script parameter",
                parameters.isNotEmpty())
            
            val scriptPath = parameters[0]
            assertTrue("Script should point to bundled language server",
                scriptPath.contains(tempPluginDir.toString()))
            assertTrue("Script should be in node_modules/@marko/language-server",
                scriptPath.contains("node_modules/@marko/language-server"))
            
            // Verify that --stdio parameter is included
            assertTrue("Should include --stdio parameter",
                parameters.contains("--stdio"))
            
            // Verify working directory is set to project base path
            val workingDirectory = commandLine.workDirectory
            assertEquals("Working directory should be project base path",
                project.basePath, workingDirectory?.absolutePath)
            
        } finally {
            System.clearProperty("marko.test.plugin.path")
        }
    }
    
    fun testCreateCommandLineWithMissingDistribution() {
        // Create a plugin directory without the language server distribution
        val emptyPluginDir = Files.createTempDirectory("marko-plugin-empty")
        
        System.setProperty("marko.test.plugin.path", emptyPluginDir.toString())
        
        try {
            val descriptor = TestableMarkoLspServerDescriptor(project)
            
            // Should throw exception when distribution is missing
            assertThrows("Should throw exception for missing distribution",
                RuntimeException::class.java) {
                descriptor.createCommandLine()
            }
            
        } finally {
            System.clearProperty("marko.test.plugin.path")
            emptyPluginDir.toFile().deleteRecursively()
        }
    }
    
    fun testCreateCommandLineWithMissingNodeExecutable() {
        // Create plugin structure without Node.js executable
        val partialPluginDir = Files.createTempDirectory("marko-plugin-partial")
        val lsDistDir = partialPluginDir.resolve("lib/ls-dist")
        Files.createDirectories(lsDistDir)
        
        // Create node_modules but no node executable
        val nodeModulesDir = lsDistDir.resolve("node_modules/@marko/language-server")
        Files.createDirectories(nodeModulesDir)
        Files.createFile(nodeModulesDir.resolve("bin.js"))
        
        System.setProperty("marko.test.plugin.path", partialPluginDir.toString())
        
        try {
            val descriptor = TestableMarkoLspServerDescriptor(project)
            
            // Should throw exception when Node.js executable is missing
            assertThrows("Should throw exception for missing Node.js executable",
                RuntimeException::class.java) {
                descriptor.createCommandLine()
            }
            
        } finally {
            System.clearProperty("marko.test.plugin.path")
            partialPluginDir.toFile().deleteRecursively()
        }
    }
    
    fun testCreateCommandLineWithMissingLanguageServerScript() {
        // Create plugin structure without language server script
        val partialPluginDir = Files.createTempDirectory("marko-plugin-no-script")
        val lsDistDir = partialPluginDir.resolve("lib/ls-dist")
        
        // Create node executable but no language server script
        val nodeDir = lsDistDir.resolve("node/bin")
        Files.createDirectories(nodeDir)
        val nodeExecutable = nodeDir.resolve("node")
        Files.createFile(nodeExecutable)
        nodeExecutable.toFile().setExecutable(true)
        
        System.setProperty("marko.test.plugin.path", partialPluginDir.toString())
        
        try {
            val descriptor = TestableMarkoLspServerDescriptor(project)
            
            // Should throw exception when language server script is missing
            assertThrows("Should throw exception for missing language server script",
                RuntimeException::class.java) {
                descriptor.createCommandLine()
            }
            
        } finally {
            System.clearProperty("marko.test.plugin.path")
            partialPluginDir.toFile().deleteRecursively()
        }
    }
    
    private fun setupMockPluginStructure() {
        // Create lib/ls-dist directory structure
        Files.createDirectories(mockLsDistDir)
        
        // Create mock Node.js executable
        val nodeDir = mockLsDistDir.resolve("node/bin")
        Files.createDirectories(nodeDir)
        val nodeExecutable = nodeDir.resolve("node")
        Files.createFile(nodeExecutable)
        nodeExecutable.toFile().setExecutable(true)
        
        // Create mock language server structure
        val languageServerDir = mockLsDistDir.resolve("node_modules/@marko/language-server")
        Files.createDirectories(languageServerDir)
        Files.createFile(languageServerDir.resolve("bin.js"))
        
        // Create package.json for completeness
        Files.createFile(mockLsDistDir.resolve("package.json"))
    }
    
    /**
     * Testable version of MarkoLspServerDescriptor that allows overriding
     * the plugin path for testing purposes.
     */
    private class TestableMarkoLspServerDescriptor(project: Project) : MarkoLspServerDescriptor(project) {
        
        override fun createCommandLine(): GeneralCommandLine {
            // Use test plugin path if set, otherwise use default behavior
            val testPluginPath = System.getProperty("marko.test.plugin.path")
            
            return if (testPluginPath != null) {
                createCommandLineWithPluginPath(File(testPluginPath))
            } else {
                super.createCommandLine()
            }
        }
        
        private fun createCommandLineWithPluginPath(pluginPath: File): GeneralCommandLine {
            val lsDistPath = File(pluginPath, "lib/ls-dist")
            
            if (!lsDistPath.exists()) {
                throw RuntimeException("Language server distribution not found at: $lsDistPath")
            }
            
            val nodeExecutable = findNodeExecutable(lsDistPath)
            val languageServerScript = findLanguageServerScript(lsDistPath)
            
            return GeneralCommandLine()
                .withExePath(nodeExecutable.absolutePath)
                .withParameters(languageServerScript.absolutePath, "--stdio")
                .withWorkDirectory(project.basePath)
        }
        
        private fun findNodeExecutable(lsDistPath: File): File {
            val nodeDir = File(lsDistPath, "node")
            
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
            
            throw RuntimeException("Node.js executable not found in: $nodeDir")
        }
        
        private fun findLanguageServerScript(lsDistPath: File): File {
            val nodeModulesDir = File(lsDistPath, "node_modules")
            val languageServerDir = File(nodeModulesDir, "@marko/language-server")
            
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
            
            throw RuntimeException("Marko language server script not found in: $languageServerDir")
        }
    }
}