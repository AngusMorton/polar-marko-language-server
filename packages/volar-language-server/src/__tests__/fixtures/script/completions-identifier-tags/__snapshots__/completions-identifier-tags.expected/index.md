## Completions
### Ln 5, Col 6
```marko
  3 |
  4 | <const/TestTagA = CustomTagA/>
> 5 | <Test/>
    |      ^ cursor
  6 | //   ^|
  7 |
```

1. `TestTagA` (Class)
2. `TestTagB` (Class)
   documentation: Custom Marko tag discovered from: [../components/TestTagB.marko](file://<workspace>/src/__tests__/fixtures/script/completions-identifier-tags/components/TestTagB.marko)

## Diagnostics
### Ln 2, Col 1
```marko
  1 | import CustomTagA from "<TestTagA>";
> 2 | import CustomTagB from "<TestTagB>";
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 'CustomTagB' is declared but its value is never read.
  3 |
  4 | <const/TestTagA = CustomTagA/>
  5 | <Test/>
```

### Ln 5, Col 2
```marko
  3 |
  4 | <const/TestTagA = CustomTagA/>
> 5 | <Test/>
    |  ^^^^ Cannot find name 'Test'.
  6 | //   ^|
  7 |
```

