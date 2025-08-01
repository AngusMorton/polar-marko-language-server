package com.markojs.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Tests for Marko file type registration and basic functionality.
 */
class MarkoFileTypeTest : BasePlatformTestCase() {
    
    fun testFileTypeRegistration() {
        val fileType = MarkoFileType.INSTANCE
        
        assertEquals("File type name should be 'Marko'", "Marko", fileType.name)
        assertEquals("File type description", "Marko template file", fileType.description)
        assertEquals("Default extension should be 'marko'", "marko", fileType.defaultExtension)
        assertNotNull("File type should have an icon", fileType.icon)
    }
    
    fun testLanguageAssociation() {
        val fileType = MarkoFileType.INSTANCE
        val language = fileType.language
        
        assertEquals("Language should be Marko", MarkoLanguage.INSTANCE, language)
        assertEquals("Language display name", "Marko", language.displayName)
        assertTrue("Language should be case sensitive", language.isCaseSensitive)
    }
    
    fun testFileRecognition() {
        // Create a .marko file and verify it's recognized correctly
        val psiFile = myFixture.configureByText("test.marko", """
            <div class="container">
                <h1>Test Marko File</h1>
            </div>
        """.trimIndent())
        
        assertNotNull("PSI file should be created", psiFile)
        assertEquals("File type should be MarkoFileType", 
            MarkoFileType.INSTANCE, psiFile.fileType)
    }
    
    fun testIconProvider() {
        val psiFile = myFixture.configureByText("icon-test.marko", "<div>Test</div>")
        val iconProvider = MarkoIconProvider()
        
        val icon = iconProvider.getIcon(psiFile, 0)
        assertNotNull("Icon provider should return an icon for Marko files", icon)
    }
}