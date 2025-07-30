plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.24"
    id("org.jetbrains.intellij.platform") version "2.7.0"
    id("com.github.node-gradle.node") version "7.0.2"
}

import org.jetbrains.intellij.platform.gradle.TestFrameworkType

group = "com.markojs"
version = "1.0.0"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        intellijIdeaUltimate("2024.1")
        bundledPlugins("com.intellij.java")
        pluginVerifier()
        zipSigner()
        
        // Test dependencies
        testFramework(TestFrameworkType.Platform)
    }
    
    implementation("org.jetbrains.kotlin:kotlin-stdlib")
    
    // Test dependencies
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.mockito:mockito-core:5.5.0")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.1.0")
}

// Node.js toolchain configuration
node {
    version.set("20.11.1")
    download.set(true)
    nodeProjectDir.set(file("$projectDir"))
}

intellijPlatform {
    pluginConfiguration {
        id = "com.markojs.intellij-plugin"
        name = "Marko Language Support"
        vendor {
            name = "Marko Team"
            url = "https://markojs.com"
        }
        description = """
            Provides language support for Marko template files (.marko) including syntax highlighting,
            code completion, error highlighting, and other IntelliSense features via the Marko Language Server.
        """.trimIndent()
        
        ideaVersion {
            sinceBuild = "241"
            untilBuild = "243.*"
        }
    }
    
    pluginVerification {
        ides {
            recommended()
        }
    }
    
    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
}

// Ensure npm install runs before building
tasks.named("compileKotlin") {
    dependsOn("npmInstall")
}

// Create a task to download Node.js runtime for bundling
val downloadNodeRuntime = tasks.register("downloadNodeRuntime") {
    val nodeVersion = "20.11.1"
    val platform = getNodePlatform()
    val nodeArchive = "node-v$nodeVersion-$platform"
    val nodeUrl = "https://nodejs.org/dist/v$nodeVersion/$nodeArchive.tar.gz"
    val nodeZipUrl = "https://nodejs.org/dist/v$nodeVersion/$nodeArchive.zip"
    
    val downloadDir = file("build/node-download")
    val extractDir = file("build/node-extracted")
    val nodeRuntimeDir = file("src/main/resources/ls-dist/node")
    
    outputs.dir(nodeRuntimeDir)
    
    doLast {
        downloadDir.mkdirs()
        extractDir.mkdirs()
        nodeRuntimeDir.deleteRecursively()
        nodeRuntimeDir.mkdirs()
        
        val isWindows = platform.contains("win")
        val archiveFile = file("$downloadDir/$nodeArchive.${if (isWindows) "zip" else "tar.gz"}")
        val downloadUrl = if (isWindows) nodeZipUrl else nodeUrl
        
        // Download Node.js runtime
        println("Downloading Node.js runtime from: $downloadUrl")
        ant.invokeMethod("get", mapOf(
            "src" to downloadUrl,
            "dest" to archiveFile
        ))
        
        // Extract Node.js runtime
        if (isWindows) {
            copy {
                from(zipTree(archiveFile))
                into(extractDir)
            }
        } else {
            copy {
                from(tarTree(archiveFile))
                into(extractDir)
            }
        }
        
        // Copy extracted Node.js to resources
        val extractedNodeDir = file("$extractDir/$nodeArchive")
        copy {
            from(extractedNodeDir)
            into(nodeRuntimeDir)
        }
        
        // Make node executable on Unix systems
        if (!isWindows) {
            val nodeExecutable = file("$nodeRuntimeDir/bin/node")
            if (nodeExecutable.exists()) {
                nodeExecutable.setExecutable(true)
            }
        }
    }
}

// Create a task to prepare the bundled language server resources
val prepareBundledResources = tasks.register("prepareBundledResources") {
    dependsOn("npmInstall", downloadNodeRuntime)
    
    val resourcesDir = file("src/main/resources/ls-dist")
    
    inputs.files(fileTree("node_modules"))
    inputs.files(file("package.json"))
    outputs.dir(resourcesDir)
    
    doLast {
        // Ensure resources directory exists
        val nodeModulesTarget = file("$resourcesDir/node_modules")
        nodeModulesTarget.mkdirs()
        
        // Copy the entire node_modules directory for hermetic environment
        copy {
            from("node_modules")
            into(nodeModulesTarget)
        }
        
        // Copy package.json and package-lock.json
        listOf("package.json", "package-lock.json").forEach { fileName ->
            val sourceFile = file(fileName)
            if (sourceFile.exists()) {
                copy {
                    from(sourceFile)
                    into(resourcesDir)
                }
            }
        }
    }
}

// Make sure resources are prepared before processing resources
tasks.named("processResources") {
    dependsOn(prepareBundledResources)
}

// Configure prepareSandbox to copy bundled resources including Node.js runtime
tasks.named("prepareSandbox") {
    doLast {
        val pluginDir = file("build/idea-sandbox/plugins/${project.name}")
        val lsDistDir = file("$pluginDir/lib/ls-dist")
        val resourcesLsDistDir = file("src/main/resources/ls-dist")
        
        if (resourcesLsDistDir.exists()) {
            copy {
                from(resourcesLsDistDir)
                into(lsDistDir)
            }
        }
    }
}

fun getNodePlatform(): String {
    val os = System.getProperty("os.name").lowercase()
    val arch = System.getProperty("os.arch").lowercase()
    
    return when {
        os.contains("windows") -> when {
            arch.contains("64") -> "win-x64"
            else -> "win-x86"
        }
        os.contains("mac") -> when {
            arch.contains("aarch64") || arch.contains("arm") -> "darwin-arm64"
            else -> "darwin-x64"
        }
        os.contains("linux") -> when {
            arch.contains("64") -> "linux-x64"
            arch.contains("arm64") || arch.contains("aarch64") -> "linux-arm64"
            else -> "linux-x86"
        }
        else -> "linux-x64"
    }
}

kotlin {
    jvmToolchain(17)
}

// Test configuration
tasks.named<Test>("test") {
    useJUnit()
    
    // Set system properties for tests
    systemProperty("idea.test.cyclic.buffer.size", "1048576")
    systemProperty("idea.home.path", System.getProperty("idea.home.path"))
    
    // Configure test data path
    systemProperty("testdata.path", "src/test/resources/testdata")
    
    // JVM arguments for tests
    jvmArgs("-Xmx2048m", "-XX:+UseConcMarkSweepGC")
    
    // Test logging
    testLogging {
        events("passed", "skipped", "failed")
        showExceptions = true
        showCauses = true
        showStackTraces = true
    }
}

// Ensure test resources are available
tasks.named("processTestResources") {
    // Make sure mock language server script is executable
    doLast {
        val mockServerScript = file("src/test/resources/testdata/mock-ls/main.js")
        if (mockServerScript.exists()) {
            mockServerScript.setExecutable(true)
        }
    }
}

// Configure test task dependencies
tasks.named("test") {
    dependsOn("processTestResources")
}