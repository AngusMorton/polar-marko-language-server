package com.markojs.intellij

import org.junit.runner.RunWith
import org.junit.runners.Suite

/**
 * Comprehensive test suite for the Marko IntelliJ Plugin.
 * 
 * This suite runs all the critical tests that validate the plugin's
 * key architectural decisions and functionality.
 */
@RunWith(Suite::class)
@Suite.SuiteClasses(
    // File type and basic functionality tests
    MarkoFileTypeTest::class,
    
    // LSP integration tests
    MarkoDiagnosticsTest::class,
    MarkoCompletionTest::class,
    MarkoHoverTest::class,
    
    // Server lifecycle and bundling tests
    MarkoServerDescriptorTest::class,
    
    // Compatibility and graceful degradation tests
    MarkoCompatibilityTest::class
)
class MarkoTestSuite {
    // This class serves as a test suite runner
    // Individual test methods are defined in the component test classes
}