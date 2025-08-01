package com.markojs.intellij

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.project.Project
import com.intellij.testFramework.fixtures.CodeInsightTestFixture
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Utility class for common test operations.
 */
object TestUtil {
    
    /**
     * Waits for asynchronous operations to complete.
     * This is useful for waiting for language server responses.
     */
    fun waitForAsyncOperations(timeoutSeconds: Long = 5) {
        val latch = CountDownLatch(1)
        
        ApplicationManager.getApplication().executeOnPooledThread {
            try {
                // Simulate processing time
                Thread.sleep(500)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
            } finally {
                latch.countDown()
            }
        }
        
        try {
            if (!latch.await(timeoutSeconds, TimeUnit.SECONDS)) {
                throw AssertionError("Timeout waiting for async operations")
            }
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
            throw AssertionError("Interrupted while waiting for async operations")
        }
    }
    
    /**
     * Configures the test environment for mock language server usage.
     */
    fun configureMockServer() {
        System.setProperty("marko.test.mock.server", "true")
        System.setProperty("marko.test.mock.server.path", 
            "src/test/resources/testdata/mock-ls/main.js")
    }
    
    /**
     * Cleans up test environment properties.
     */
    fun cleanupMockServer() {
        System.clearProperty("marko.test.mock.server")
        System.clearProperty("marko.test.mock.server.path")
    }
    
    /**
     * Creates a test Marko file with the given content.
     */
    fun createMarkoFile(fixture: CodeInsightTestFixture, fileName: String, content: String) {
        fixture.configureByText(fileName, content)
    }
    
    /**
     * Verifies that a file has the correct Marko file type.
     */
    fun verifyMarkoFile(fixture: CodeInsightTestFixture) {
        val file = fixture.file
        assert(file != null) { "File should exist" }
        assert(file.fileType == MarkoFileType.INSTANCE) { "File type should be MarkoFileType" }
    }
    
    /**
     * Gets the test data directory path.
     */
    fun getTestDataPath(): String {
        return "src/test/resources/testdata/files"
    }
    
    /**
     * Simulates a language server startup delay.
     */
    fun simulateServerStartup() {
        try {
            Thread.sleep(200) // Simulate server startup time
        } catch (e: InterruptedException) {
            Thread.currentThread().interrupt()
        }
    }
}