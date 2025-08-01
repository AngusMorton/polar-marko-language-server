# Debugging Marko TextMate Syntax Highlighting

This document provides debugging strategies for the TextMate-only syntax highlighting implementation.

## Current Architecture

The plugin uses **ONLY TextMate grammars** for syntax highlighting:

1. **TextMate Grammar** (only method) - Uses existing VS Code grammar files
2. **No highlighting** if TextMate plugin not available

## Key Components

### Core Files

- `MarkoSyntaxHighlighterFactory` - Delegates to TextMate when available
- `MarkoTextMateRegistrar` - Registers TextMate grammars at startup
- `MarkoParserDefinition` - Minimal parser for file recognition only

### Grammar Files

- `/textmate/marko.tmLanguage.json` - Main Marko syntax grammar
- `/textmate/embedded.marko.tmLanguage.json` - Embedded Marko grammar

## Prerequisites

**Required Plugin:** TextMate bundles support

- IntelliJ Ultimate: Built-in
- IntelliJ Community: Install "TextMate Bundles" plugin

## Quick Test

Create a test file `test.marko`:

```marko
<div class="test">
  <h1>Hello ${name}</h1>
  <!-- This is a comment -->
  <MyComponent prop=value>
    <for|item| of=items>
      <div>${item.name}</div>
    </for>
  </MyComponent>
</div>
```

## Manual Testing Steps

1. **Install TextMate Plugin** (if using Community Edition)
2. **Build plugin:** `./gradlew buildPlugin`
3. **Install** `build/distributions/*.zip` in IntelliJ
4. **Create test project** with `.marko` files
5. **Check syntax highlighting** appears

## Debugging Steps

### 1. Check TextMate Plugin

- Settings → Plugins → Search "TextMate"
- Ensure TextMate bundles plugin is installed and enabled

### 2. Check Grammar Registration

Look for log messages:

```
Registered Marko TextMate grammar
Registered embedded Marko TextMate grammar
```

### 3. Check File Association

- Right-click `.marko` file → Properties
- Should show "Marko" as file type

### 4. Enable Debug Logging

Add to Help → Diagnostic Tools → Debug Log Settings:

```
com.markojs.intellij
```

## Current Status

✅ **Simplified:** TextMate-only architecture
✅ **Clean:** Removed all pattern-based highlighting
✅ **Working:** Plugin builds successfully  
⏳ **To Test:** TextMate highlighting in IntelliJ

## Expected Results

With TextMate plugin installed, you should see:

- **Tags:** Colored syntax for HTML-like elements
- **Attributes:** Different colors for attribute names/values
- **Placeholders:** Special highlighting for `${...}` expressions
- **Comments:** Dimmed text for `<!-- -->` comments
- **Control Flow:** Keywords like `for`, `if` highlighted

If no highlighting appears, TextMate plugin may not be installed or grammars failed to register.
