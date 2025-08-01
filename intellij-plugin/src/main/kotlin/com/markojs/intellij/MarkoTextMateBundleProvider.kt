package com.markojs.intellij

import org.jetbrains.plugins.textmate.api.TextMateBundleProvider
import java.nio.file.Paths

/**
 * Provides the Marko TextMate bundle for syntax highlighting.
 * This replaces the custom registration approach with the proper
 * IntelliJ Platform TextMate extension point.
 */
class MarkoTextMateBundleProvider : TextMateBundleProvider {
    
    override fun getBundles(): List<TextMateBundleProvider.PluginBundle> {
        return listOf(
            TextMateBundleProvider.PluginBundle(
                "marko", // Unique bundle identifier
                Paths.get("/textmate/marko.tmbundle") // Path to the .tmbundle directory
            )
        )
    }
}