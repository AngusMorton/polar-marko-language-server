## Definitions
### Ln 33, Col 30
```marko
  31 |     languageCode: $global.languageCode,
  32 |     origin: "Hotels-Near",
> 33 |     destination: input.destinationCanonical,
     |                              ^ definition
  34 |     //                       ^!
  35 |   })
  36 | />
```

1. index.marko:2:3
originSelectionRange: present
origin:
```marko
  31 |     languageCode: $global.languageCode,
  32 |     origin: "Hotels-Near",
> 33 |     destination: input.destinationCanonical,
     |                        ^^^^^^^^^^^^^^^^^^^^ origin
  34 |     //                       ^!
  35 |   })
  36 | />
```
```marko
  1 | export interface Input {
> 2 |   destinationCanonical: string;
    |   ^^^^^^^^^^^^^^^^^^^^ definition
  3 |   show: boolean;
  4 | }
  5 |
```

### Ln 38, Col 125
```marko
  36 | />
  37 |
> 38 | <tracked-link href=buildExploreHotelsHref({ languageCode: $global.languageCode, origin: "Hotels-Near", destination: input.destinationCanonical }) />
     |                                                                                                                             ^ definition
  39 | //                                                                                                                          ^!
  40 |
```

1. index.marko:2:3
originSelectionRange: present
origin:
```marko
  36 | />
  37 |
> 38 | <tracked-link href=buildExploreHotelsHref({ languageCode: $global.languageCode, origin: "Hotels-Near", destination: input.destinationCanonical }) />
     |                                                                                                                           ^^^^^^^^^^^^^^^^^^^^ origin
  39 | //                                                                                                                          ^!
  40 |
```
```marko
  1 | export interface Input {
> 2 |   destinationCanonical: string;
    |   ^^^^^^^^^^^^^^^^^^^^ definition
  3 |   show: boolean;
  4 | }
  5 |
```

## Document Links
No document links.

