## Completions
### Ln 2, Col 13
```marko
  1 | <fancy-button>
> 2 |   <@icon na/>
    |             ^ cursor
  3 |   //        ^|
  4 | </fancy-button>
  5 |
```

No completions.

### Ln 7, Col 12
```marko
   5 |
   6 | <test-tag>
>  7 |   <@item x/>
     |            ^ cursor
   8 |   //       ^|
   9 | </test-tag>
  10 |
```

No completions.

### Ln 12, Col 6
```marko
  10 |
  11 | <fancy-button>
> 12 |   <@/>
     |      ^ cursor
  13 |   // ^|
  14 | </fancy-button>
  15 |
```

No completions.

## Diagnostics
### Ln 2, Col 10
```marko
  1 | <fancy-button>
> 2 |   <@icon na/>
    |          ^^ Object literal may only specify known properties, and '"na"' does not exist in type 'AttrTag<{ name: string; content?: Body<[info: { active: boolean; }], void> | undefined; }>'.
  3 |   //        ^|
  4 | </fancy-button>
  5 |
```

### Ln 7, Col 4
```marko
   5 |
   6 | <test-tag>
>  7 |   <@item x/>
     |    ^^^^^ Object literal may only specify known properties, and '["item"]' does not exist in type 'Input'.
   8 |   //       ^|
   9 | </test-tag>
  10 |
```

### Ln 12, Col 4
```marko
  10 |
  11 | <fancy-button>
> 12 |   <@/>
     |    ^ Object literal may only specify known properties, and '[""]' does not exist in type 'Input'.
  13 |   // ^|
  14 | </fancy-button>
  15 |
```

