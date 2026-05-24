## Hovers
### Ln 5, Col 7
```marko
  3 | static const value = { something: true };
  4 |
> 5 | <FancyButton custom={ value } title="hello" />
    |       ^ Input Props:
- `custom?: { value: { something: boolean; }; }`
- `title?: string`
- `a?: string`
- `first?: number`

Input Events:
- `onSave: (): void`

Attr Tags:
- `@icon?` with `name?: string`

Result:
- `void`

Input:

export interface Input {
  /** Custom object docs. */
  custom?: { value: { something: boolean } };
  /** Title docs. */
  title?: string;
  /** One-character attr docs. */
  a?: string;
  first?: number;
  /** Save callback docs. */
  onSave?: () => void;
  /** Icon attr tag docs. */
  icon?: Marko.AttrTag<{
    /** Icon name docs. */
    name?: string;
  }>;
}
  6 | //    ^?    ^?    ^?     ^~  ^?
  7 |
  8 | <FancyButton custom={ value: { something: true } } title="hello" />
```

### Ln 5, Col 13
```marko
  3 | static const value = { something: true };
  4 |
> 5 | <FancyButton custom={ value } title="hello" />
    |             ^ Input Props:
- `custom?: { value: { something: boolean; }; }`
- `title?: string`
- `a?: string`
- `first?: number`

Input Events:
- `onSave: (): void`

Attr Tags:
- `@icon?` with `name?: string`

Result:
- `void`

Input:

export interface Input {
  /** Custom object docs. */
  custom?: { value: { something: boolean } };
  /** Title docs. */
  title?: string;
  /** One-character attr docs. */
  a?: string;
  first?: number;
  /** Save callback docs. */
  onSave?: () => void;
  /** Icon attr tag docs. */
  icon?: Marko.AttrTag<{
    /** Icon name docs. */
    name?: string;
  }>;
}
  6 | //    ^?    ^?    ^?     ^~  ^?
  7 |
  8 | <FancyButton custom={ value: { something: true } } title="hello" />
```

### Ln 5, Col 19
```marko
  3 | static const value = { something: true };
  4 |
> 5 | <FancyButton custom={ value } title="hello" />
    |                   ^ `custom?: { value: { something: boolean; }; }`

Custom object docs.
  6 | //    ^?    ^?    ^?     ^~  ^?
  7 |
  8 | <FancyButton custom={ value: { something: true } } title="hello" />
```

### Ln 5, Col 26
```marko
  3 | static const value = { something: true };
  4 |
> 5 | <FancyButton custom={ value } title="hello" />
    |                       ^^^^^ (property) value: {
    something: boolean;
}
  6 | //    ^?    ^?    ^?     ^~  ^?
  7 |
  8 | <FancyButton custom={ value: { something: true } } title="hello" />
```

### Ln 8, Col 34
```marko
   6 | //    ^?    ^?    ^?     ^~  ^?
   7 |
>  8 | <FancyButton custom={ value: { something: true } } title="hello" />
     |                                ^^^^^^^^^ (property) something: boolean
   9 | //                               ^~
  10 |
  11 | <FancyButton first=1   title="hello" />
```

### Ln 14, Col 14
```marko
  12 | //                    ^?
  13 |
> 14 | <FancyButton a="one" />
     |              ^ `a?: string`

One-character attr docs.
  15 | //           ^?^?
  16 |
  17 | <FancyButton title:scoped="primary" />
```

### Ln 17, Col 20
```marko
  15 | //           ^?^?
  16 |
> 17 | <FancyButton title:scoped="primary" />
     |                    ^ Use to prefix with a unique ID.
  18 | //                 ^?
  19 |
  20 | <FancyButton onSave() {} />
```

### Ln 20, Col 14
```marko
  18 | //                 ^?
  19 |
> 20 | <FancyButton onSave() {} />
     |              ^ `onSave: (): void`

Save callback docs.
  21 | //           ^?
  22 |
  23 | <FancyButton>
```

### Ln 24, Col 9
```marko
  22 |
  23 | <FancyButton>
> 24 |   <@icon name="search" />
     |         ^ `@icon?` with `name?: string`

Icon attr tag docs.
  25 |   //    ^?  ^?
  26 | </FancyButton>
  27 |
```

### Ln 24, Col 13
```marko
  22 |
  23 | <FancyButton>
> 24 |   <@icon name="search" />
     |             ^ `name?: string`

Icon name docs.
  25 |   //    ^?  ^?
  26 | </FancyButton>
  27 |
```

### Ln 28, Col 13
```marko
  26 | </FancyButton>
  27 |
> 28 | <FancyButton />
     |  ^^^^^^^^^^^ Input Props:
- `custom?: { value: { something: boolean; }; }`
- `title?: string`
- `a?: string`
- `first?: number`

Input Events:
- `onSave: (): void`

Attr Tags:
- `@icon?` with `name?: string`

Result:
- `void`

Input:

export interface Input {
  /** Custom object docs. */
  custom?: { value: { something: boolean } };
  /** Title docs. */
  title?: string;
  /** One-character attr docs. */
  a?: string;
  first?: number;
  /** Save callback docs. */
  onSave?: () => void;
  /** Icon attr tag docs. */
  icon?: Marko.AttrTag<{
    /** Icon name docs. */
    name?: string;
  }>;
}
  29 | //          ^~
  30 |
  31 | <input />
```

### Ln 31, Col 7
```marko
  29 | //          ^~
  30 |
> 31 | <input />
     |  ^^^^^ Built in [&lt;input&gt;](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input) HTML tag.
  32 | //    ^~
  33 |
```

