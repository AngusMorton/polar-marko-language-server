## Hovers
### Ln 4, Col 3
```marko
  2 | //  ^|
  3 |
> 4 | <fancy-button/>
    |   ^ I'm a JSDoc comment for the template.

Input Props:
- `message?: string`

Result:
- `void`

Input:

export interface Input {
  /**
   * I'm a JSDoc comment for the message property.
   */
  message?: string;
}
  5 | //^?
  6 |
```

## Completions
### Ln 1, Col 5
```marko
> 1 | <fan/>
    |     ^ cursor
  2 | //  ^|
  3 |
  4 | <fancy-button/>
```

1. `fancy-button`
   documentation: Custom Marko tag discovered from: [../components/fancy-button/index.marko](file://<workspace>/src/__tests__/fixtures/script/completions-local-tags/components/fancy-button/index.marko)...

