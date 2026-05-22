## Completions
### Ln 1, Col 21
```marko
> 1 | import Child from "<Child>";
    |                     ^ cursor
  2 | //                  ^|
  3 |
```

1. `<Child>`
   documentation: Custom Marko tag discovered from: [../components/Child/index.js](file://<workspace>/src/__tests__/fixtures/script/completions-import-tags/components/Child/index.js)
2. `<child-other>`
   documentation: Custom Marko tag discovered from: [../components/child-other/index.js](file://<workspace>/src/__tests__/fixtures/script/completions-import-tags/components/child-other/index.js)

## Diagnostics
### Ln 1, Col 1
```marko
> 1 | import Child from "<Child>";
    | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 'Child' is declared but its value is never read.
  2 | //                  ^|
  3 |
```

### Ln 1, Col 19
```marko
> 1 | import Child from "<Child>";
    |                   ^^^^^^^^^ Could not find a declaration file for module './components/Child/index.js'. '<workspace>/src/__tests__/fixtures/script/completions-import-tags/components/Child/index.js' implicitly has an 'any' type.
  2 | //                  ^|
  3 |
```

