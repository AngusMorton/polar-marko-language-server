package com.markojs.intellij

import com.intellij.ide.AppLifecycleListener
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.logger

/**
 * Startup listener for the Marko plugin to handle initialization and compatibility checks.
 */
class MarkoPluginStartupListener : AppLifecycleListener {
    
    companion object {
        private val LOG = logger<MarkoPluginStartupListener>()
        private const val NOTIFICATION_GROUP_ID = "Marko Plugin"
    }
    
    override fun appFrameCreated(commandLineArgs: MutableList<String>) {
        ApplicationManager.getApplication().executeOnPooledThread {
            checkCompatibility()
        }
    }
    
    private fun checkCompatibility() {
        LOG.info("=== MARKO PLUGIN STARTUP DEBUG ===")
        
        // Check plugin classes loading
        checkPluginClasses()
        
        // Check LSP support
        val hasNativeLsp = hasNativeLspSupport()
        val hasLsp4ij = hasLsp4ijSupport()
        
        LOG.info("Native LSP: $hasNativeLsp, LSP4IJ: $hasLsp4ij")
        
        // Check bundled dependencies
        checkBundledDependencies()
        
        if (!hasNativeLsp && !hasLsp4ij) {
            showCompatibilityWarning()
        } else {
            showSuccessNotification()
        }
        
        LOG.info("=== MARKO PLUGIN STARTUP COMPLETE ===")
    }
    
    private fun checkPluginClasses() {
        try {
            val fileType = MarkoFileType.INSTANCE
            LOG.info("✓ MarkoFileType loaded: ${fileType.name}")
            
            val language = MarkoLanguage.INSTANCE  
            LOG.info("✓ MarkoLanguage loaded: ${language.displayName}")
            
        } catch (e: Exception) {
            LOG.error("✗ Error loading plugin classes", e)
        }
    }
    
    private fun checkBundledDependencies() {
        try {
            val pluginPath = getPluginPath()
            LOG.info("Plugin path: $pluginPath")
            
            if (pluginPath != "unknown" && pluginPath != "error") {
                val lsDistPath = java.io.File(pluginPath, "lib/ls-dist")
                LOG.info("LS dist exists: ${lsDistPath.exists()}")
                
                if (lsDistPath.exists()) {
                    val nodeDir = java.io.File(lsDistPath, "node")
                    val nodeModules = java.io.File(lsDistPath, "node_modules")
                    val languageServer = java.io.File(nodeModules, "@marko/language-server")
                    
                    LOG.info("✓ Node.js bundled: ${nodeDir.exists()}")
                    LOG.info("✓ node_modules: ${nodeModules.exists()}")
                    LOG.info("✓ Language server: ${languageServer.exists()}")
                    
                    if (languageServer.exists()) {
                        val binJs = java.io.File(languageServer, "bin.js")
                        LOG.info("✓ Server entry point: ${binJs.exists()}")
                    }
                } else {
                    LOG.warn("✗ Bundled dependencies not found - LSP features may not work")
                }
            }
        } catch (e: Exception) {
            LOG.error("Error checking bundled dependencies", e)
        }
    }
    
    private fun getPluginPath(): String {
        return try {
            // Use system property for plugin path if available (for debugging)
            System.getProperty("plugin.path") ?: "build/idea-sandbox/plugins/marko-intellij-plugin"
        } catch (e: Exception) {
            LOG.error("Error getting plugin path", e)
            "error"
        }
    }
    
    private fun showSuccessNotification() {
        ApplicationManager.getApplication().invokeLater {
            NotificationGroupManager.getInstance()
                .getNotificationGroup(NOTIFICATION_GROUP_ID)
                .createNotification(
                    "Marko Language Support",
                    "Plugin loaded successfully with LSP support",
                    NotificationType.INFORMATION
                )
                .notify(null)
        }
    }
    
    private fun hasNativeLspSupport(): Boolean {
        return try {
            Class.forName("com.intellij.platform.lsp.api.LspServerSupportProvider")
            true
        } catch (e: ClassNotFoundException) {
            false
        }
    }
    
    private fun hasLsp4ijSupport(): Boolean {
        return try {
            Class.forName("com.redhat.devtools.lsp4ij.LanguageServerFactory")
            true
        } catch (e: ClassNotFoundException) {
            false
        }
    }
    
    private fun showCompatibilityWarning() {
        ApplicationManager.getApplication().invokeLater {
            NotificationGroupManager.getInstance()
                .getNotificationGroup(NOTIFICATION_GROUP_ID)
                .createNotification(
                    "Marko Language Support",
                    "For full functionality in IntelliJ IDEA Community Edition, please install the LSP4IJ plugin from the JetBrains Marketplace.",
                    NotificationType.WARNING
                )
                .notify(null)
        }
    }
}