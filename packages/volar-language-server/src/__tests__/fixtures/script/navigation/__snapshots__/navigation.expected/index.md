## Hovers
### Ln 5, Col 13
```marko
  3 | static const testId = "button-id";
  4 |
> 5 | <div no-update-body/>
    |             ^ [More Info](https://markojs.com/docs/class-components/#no-update-body)
  6 | //          ^?
  7 |
  8 | <div id:no-update="value"/>
```

### Ln 8, Col 10
```marko
   6 | //          ^?
   7 |
>  8 | <div id:no-update="value"/>
     |          ^ Use to skip future updates to this attribute.
   9 | //       ^?
  10 |
  11 | <fancy-button />
```

### Ln 11, Col 13
```marko
   9 | //       ^?
  10 |
> 11 | <fancy-button />
     |             ^ Custom Marko tag discovered from:

[../components/fancy-button/index.marko](file:///Users/angus/marko-language-server/packages/volar-language-server/src/__tests__/fixtures/script/navigation/components/fancy-button/index.marko)

Input Props:
- `message?: string`
- `tone?: "info" | "warning"`
- `custom?: { temp: boolean; options: boolean; }`
- `title?: string`

Input Events:
- `onSelect: (value: string): void`

Attr Tags:
- `@icon?` with `name: string` content `(info: { active: boolean; }) => void` via `input.content`

Content:
- `(state: { pressed: boolean; }) => void` via `input.content`

Result:
- `{ value: { pressed: boolean; }; }`

Input:

export interface Input {
  message?: string;
  tone?: Tone;
  custom?: { temp: boolean; options: boolean };
  /** Component-specific title docs. */
  title?: string;
  /** Selection callback. */
  onSelect?(value: string): void;
  /** Icon attr tag. */
  icon?: Marko.AttrTag<{
    /** Icon name. */
    name: string;
    /** Icon content. */
    content?: Marko.Body<[info: { active: boolean }], void>;
  }>;
  /** Button content. */
  content?: Marko.Body<[state: { pressed: boolean }], void>;
}
  12 | //      ^!  ^?
  13 |
  14 | <FancyButton />
```

### Ln 14, Col 10
```marko
  12 | //      ^!  ^?
  13 |
> 14 | <FancyButton />
     |          ^ Input Props:
- `message?: string`
- `tone?: "info" | "warning"`
- `custom?: { temp: boolean; options: boolean; }`
- `title?: string`

Input Events:
- `onSelect: (value: string): void`

Attr Tags:
- `@icon?` with `name: string` content `(info: { active: boolean; }) => void` via `input.content`

Content:
- `(state: { pressed: boolean; }) => void` via `input.content`

Result:
- `{ value: { pressed: boolean; }; }`

Input:

export interface Input {
  message?: string;
  tone?: Tone;
  custom?: { temp: boolean; options: boolean };
  /** Component-specific title docs. */
  title?: string;
  /** Selection callback. */
  onSelect?(value: string): void;
  /** Icon attr tag. */
  icon?: Marko.AttrTag<{
    /** Icon name. */
    name: string;
    /** Icon content. */
    content?: Marko.Body<[info: { active: boolean }], void>;
  }>;
  /** Button content. */
  content?: Marko.Body<[state: { pressed: boolean }], void>;
}
  15 | //       ^?
  16 |
  17 | <fancy-button message="hello" title="hello" onSelect() {}/>
```

### Ln 17, Col 20
```marko
  15 | //       ^?
  16 |
> 17 | <fancy-button message="hello" title="hello" onSelect() {}/>
     |                    ^ `message?: string`
  18 | //                 ^?             ^?             ^!
  19 |
  20 | <fancy-button custom={ temp: true, options: false } />
```

### Ln 17, Col 35
```marko
  15 | //       ^?
  16 |
> 17 | <fancy-button message="hello" title="hello" onSelect() {}/>
     |                                   ^ `title?: string`

Component-specific title docs.
  18 | //                 ^?             ^?             ^!
  19 |
  20 | <fancy-button custom={ temp: true, options: false } />
```

### Ln 20, Col 25
```marko
  18 | //                 ^?             ^?             ^!
  19 |
> 20 | <fancy-button custom={ temp: true, options: false } />
     |                        ^^^^ (property) temp: boolean
  21 | //                      ^~
  22 |
  23 | <fancy-button>
```

### Ln 24, Col 8
```marko
  22 |
  23 | <fancy-button>
> 24 |   <@icon name="search"/>
     |        ^ `@icon?` with `name: string` content `(info: { active: boolean; }) => void` via `input.content`

Icon attr tag.
  25 |   //   ^?
  26 | </fancy-button>
  27 |
```

### Ln 31, Col 13
```marko
  29 | //       ^!
  30 |
> 31 | <button id=testId>Test</button>
     |            ^^^^^^ const testId: "button-id"
  32 | //          ^~
  33 |
```

## Definitions
### Ln 11, Col 9
```marko
   9 | //       ^?
  10 |
> 11 | <fancy-button />
     |         ^ definition
  12 | //      ^!  ^?
  13 |
  14 | <FancyButton />
```

1. components/fancy-button/index.marko:3:10
```marko
  1 | static type Tone = "info" | "warning";
  2 |
> 3 | export interface Input {
    |          ^^^^^ definition
  4 |   message?: string;
  5 |   tone?: Tone;
  6 |   custom?: { temp: boolean; options: boolean };
```
2. components/fancy-button/index.marko:1:1
```marko
> 1 | static type Tone = "info" | "warning";
    | ^ definition
  2 |
  3 | export interface Input {
  4 |   message?: string;
```

### Ln 17, Col 50
```marko
  15 | //       ^?
  16 |
> 17 | <fancy-button message="hello" title="hello" onSelect() {}/>
     |                                                  ^ definition
  18 | //                 ^?             ^?             ^!
  19 |
  20 | <fancy-button custom={ temp: true, options: false } />
```

1. components/fancy-button/index.marko:9:24
```marko
   7 |   /** Component-specific title docs. */
   8 |   title?: string;
>  9 |   /** Selection callback. */
     |                        ^^^^^
> 10 |   onSelect?(value: string): void;
     | ^^^ definition
  11 |   /** Icon attr tag. */
  12 |   icon?: Marko.AttrTag<{
  13 |     /** Icon name. */
```
2. components/fancy-button/index.marko:10:3
```marko
   8 |   title?: string;
   9 |   /** Selection callback. */
> 10 |   onSelect?(value: string): void;
     |   ^^^^^^^^ definition
  11 |   /** Icon attr tag. */
  12 |   icon?: Marko.AttrTag<{
  13 |     /** Icon name. */
```

### Ln 28, Col 10
```marko
  26 | </fancy-button>
  27 |
> 28 | <child value=(next) => next />
     |          ^ definition
  29 | //       ^!
  30 |
  31 | <button id=testId>Test</button>
```

1. tags/child.marko:1:1
```marko
> 1 | export interface Input {
    | ^ definition
  2 |   value: (next: string) => string;
  3 | }
  4 |
```
2. tags/child.marko:2:3
```marko
  1 | export interface Input {
> 2 |   value: (next: string) => string;
    |   ^^^^^ definition
  3 | }
  4 |
  5 | <div/>
```

