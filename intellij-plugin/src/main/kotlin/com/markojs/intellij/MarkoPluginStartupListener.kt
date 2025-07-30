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
        val hasNativeLsp = hasNativeLspSupport()
        val hasLsp4ij = hasLsp4ijSupport()
        
        LOG.info("Marko plugin compatibility check - Native LSP: $hasNativeLsp, LSP4IJ: $hasLsp4ij")
        
        if (!hasNativeLsp && !hasLsp4ij) {
            showCompatibilityWarning()
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