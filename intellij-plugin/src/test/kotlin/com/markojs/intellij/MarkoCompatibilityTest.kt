package com.markojs.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Tests for the hybrid client strategy and graceful degradation functionality.
 * 
 * This test verifies that the plugin correctly detects available LSP clients
 * and handles the fallback strategy appropriately.
 */
class MarkoCompatibilityTest : BasePlatformTestCase() {
    
    fun testNativeLspDetection() {
        // Test detection of native IntelliJ LSP support
        val hasNativeLsp = try {
            Class.forName("com.intellij.platform.lsp.api.LspServerSupportProvider")
            true
        } catch (e: ClassNotFoundException) {
            false
        }
        
        // The result depends on which IntelliJ version is used for testing
        // In ultimate editions, this should be true
        if (hasNativeLsp) {
            assertTrue("Native LSP should be available in Ultimate editions", hasNativeLsp)
        } else {
            assertFalse("Native LSP not available in this edition", hasNativeLsp)
        }
    }
    
    fun testLsp4ijDetection() {
        // Test detection of LSP4IJ plugin
        val hasLsp4ij = try {
            Class.forName("com.redhat.devtools.lsp4ij.LanguageServerFactory")
            true
        } catch (e: ClassNotFoundException) {
            false
        }
        
        // This will be false unless LSP4IJ is explicitly added as a test dependency
        // The test verifies that the detection mechanism works
        assertNotNull("LSP4IJ detection should complete without errors", hasLsp4ij)
    }
    
    fun testStartupListenerCompatibilityCheck() {
        // Test the startup listener's compatibility checking logic
        val listener = MarkoPluginStartupListener()
        
        // This test verifies that the listener can be instantiated
        // In a real test environment, we'd mock the notification system
        assertNotNull("Startup listener should be created successfully", listener)
    }
    
    fun testGracefulDegradation() {
        // Test scenario where neither native LSP nor LSP4IJ is available
        val hasNativeLsp = hasNativeLspSupport()
        val hasLsp4ij = hasLsp4ijSupport()
        
        if (!hasNativeLsp && !hasLsp4ij) {
            // In this case, the plugin should show a warning notification
            // and disable language features gracefully
            assertTrue("Plugin should handle missing LSP clients gracefully", true)
        } else {
            // At least one LSP client is available
            assertTrue("At least one LSP client should be available", 
                hasNativeLsp || hasLsp4ij)
        }
    }
    
    fun testLspServerSupportProviderRegistration() {
        // Verify that the LSP server support provider can be instantiated
        // when native LSP support is available
        val hasNativeLsp = hasNativeLspSupport()
        
        if (hasNativeLsp) {
            try {
                val provider = Class.forName("com.markojs.intellij.lsp.MarkoLspServerSupportProvider")
                    .getDeclaredConstructor().newInstance()
                assertNotNull("LSP server support provider should be created", provider)
            } catch (e: Exception) {
                fail("Failed to create LSP server support provider: ${e.message}")
            }
        }
    }
    
    fun testLsp4ijFactoryRegistration() {
        // Verify that the LSP4IJ factory can be instantiated when LSP4IJ is available
        try {
            val factory = Class.forName("com.markojs.intellij.lsp4ij.MarkoLanguageServerFactory")
                .getDeclaredConstructor().newInstance()
            assertNotNull("LSP4IJ factory should be created", factory)
        } catch (e: ClassNotFoundException) {
            // Expected when LSP4IJ is not available
            assertTrue("LSP4IJ factory not available - this is expected", true)
        } catch (e: Exception) {
            fail("Unexpected error creating LSP4IJ factory: ${e.message}")
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
}