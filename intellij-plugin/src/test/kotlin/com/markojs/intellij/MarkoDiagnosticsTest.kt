package com.markojs.intellij

import com.intellij.codeInsight.daemon.impl.HighlightInfo
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.openapi.application.ApplicationManager
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import com.intellij.testFramework.fixtures.CodeInsightTestFixture
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Tests for LSP-based diagnostics integration in Marko files.
 * 
 * This test verifies that the plugin correctly receives and displays
 * diagnostics from the language server.
 */
class MarkoDiagnosticsTest : BasePlatformTestCase() {
    
    override fun getTestDataPath(): String {
        return "src/test/resources/testdata/files"
    }
    
    override fun setUp() {
        super.setUp()
        
        // Configure the test environment to use our mock language server
        System.setProperty("marko.test.mock.server", "true")
        System.setProperty("marko.test.mock.server.path", 
            "src/test/resources/testdata/mock-ls/main.js")
    }
    
    override fun tearDown() {
        System.clearProperty("marko.test.mock.server")
        System.clearProperty("marko.test.mock.server.path")
        super.tearDown()
    }
    
    fun testDiagnosticsProvided() {
        // Configure the test file
        myFixture.configureByFile("diagnostics.marko")
        
        // Wait for the language server to process the file and send diagnostics
        waitForDiagnostics()
        
        // Trigger highlighting to get diagnostics
        val highlights = myFixture.doHighlighting()
        
        // Verify we received the expected diagnostics
        assertTrue("Should have diagnostics", highlights.isNotEmpty())
        
        // Find the error diagnostic for undefined-component
        val errorDiagnostic = highlights.find { highlight ->
            highlight.description.contains("undefined-component") &&
            highlight.severity == HighlightSeverity.ERROR
        }
        
        assertNotNull("Should have error diagnostic for undefined-component", errorDiagnostic)
        
        // Find the warning diagnostic for missing-attribute
        val warningDiagnostic = highlights.find { highlight ->
            highlight.description.contains("missing-attribute") &&
            highlight.severity == HighlightSeverity.WARNING
        }
        
        assertNotNull("Should have warning diagnostic for missing-attribute", warningDiagnostic)
        
        // Verify the error diagnostic details
        errorDiagnostic?.let { diagnostic ->
            assertEquals("Component \"undefined-component\" is not defined", diagnostic.description)
            assertTrue("Error should be on line with undefined-component", 
                diagnostic.startOffset > 0)
        }
    }
    
    fun testNoDiagnosticsForValidFile() {
        // Create a valid Marko file
        myFixture.configureByText("valid.marko", """
            <div class="container">
                <h1>Valid Marko File</h1>
                <p>This file should not have any diagnostics</p>
            </div>
        """.trimIndent())
        
        waitForDiagnostics()
        
        val highlights = myFixture.doHighlighting()
        
        // Filter only error and warning highlights (ignore info-level ones)
        val errorWarningHighlights = highlights.filter { 
            it.severity == HighlightSeverity.ERROR || it.severity == HighlightSeverity.WARNING 
        }
        
        assertTrue("Valid file should not have error or warning diagnostics", 
            errorWarningHighlights.isEmpty())
    }
    
    fun testDiagnosticsUpdateOnFileChange() {
        // Start with a valid file
        myFixture.configureByText("changeable.marko", """
            <div class="container">
                <h1>Initially Valid</h1>
            </div>
        """.trimIndent())
        
        waitForDiagnostics()
        
        var highlights = myFixture.doHighlighting()
        val initialErrorCount = highlights.count { it.severity == HighlightSeverity.ERROR }
        
        // Modify the file to introduce an error
        ApplicationManager.getApplication().runWriteAction {
            myFixture.editor.document.setText("""
                <div class="container">
                    <h1>Now Invalid</h1>
                    <undefined-component />
                </div>
            """.trimIndent())
        }
        
        waitForDiagnostics()
        
        highlights = myFixture.doHighlighting()
        val finalErrorCount = highlights.count { it.severity == HighlightSeverity.ERROR }
        
        assertTrue("Should have more errors after introducing undefined component",
            finalErrorCount > initialErrorCount)
    }
    
    /**
     * Wait for the language server to process diagnostics.
     * In a real implementation, this would wait for LSP diagnostics to arrive.
     */
    private fun waitForDiagnostics() {
        val latch = CountDownLatch(1)
        
        // Simulate waiting for language server response
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                Thread.sleep(500) // Simulate server processing time
            } catch (e: InterruptedException) {
                // Ignore
            } finally {
                latch.countDown()
            }
        }
        
        try {
            latch.await(5, TimeUnit.SECONDS)
        } catch (e: InterruptedException) {
            fail("Timeout waiting for diagnostics")
        }
    }
}