## Completions
### Ln 1, Col 19
```marko
> 1 | <fancy-button mess/>
    |                   ^ cursor
  2 | //                ^|
  3 |
  4 | <fancy-button on/>
```

1. `message` (Field)
   newText: `message="$1"$0`
   documentation: \`message: string\`

### Ln 4, Col 17
```marko
  2 | //                ^|
  3 |
> 4 | <fancy-button on/>
    |                 ^ cursor
  5 | //              ^|
  6 |
  7 | <div cla/>
```

1. `on<event>("<method>")?` (Event)
   newText: `on${1:Click}("handle${2:Button}${1:Click}")`
   documentation: [More Info](https://markojs.com/docs/components/#attaching-dom-event-listeners)
2. `once<event>("<method>")?` (Event)
   newText: `once${1:Click}("handle${2:Button}${1:Click}")`
   documentation: [More Info](https://markojs.com/docs/components/#attaching-dom-event-listeners)
3. `onabort?` (Event)
   newText: `onabort=`
   documentation: \`onabort?: null | string | false\`
4. `onauxclick?` (Event)
   newText: `onauxclick=`
   documentation: \`onauxclick?: null | string | false\`

### Ln 7, Col 9
```marko
   5 | //              ^|
   6 |
>  7 | <div cla/>
     |         ^ cursor
   8 | //      ^|
   9 |
  10 | <div id:s/>
```

1. `class` (Field)

### Ln 10, Col 10
```marko
   8 | //      ^|
   9 |
> 10 | <div id:s/>
     |          ^ cursor
  11 | //       ^|
  12 |
  13 | <button type="su"/>
```

1. `scoped` (Keyword)
   detail: Use to prefix with a unique ID

### Ln 13, Col 17
```marko
  11 | //       ^|
  12 |
> 13 | <button type="su"/>
     |                 ^ cursor
  14 | //              ^|
  15 |
```

1. `submit` (EnumMember)

## Diagnostics
### Ln 1, Col 15
```marko
> 1 | <fancy-button mess/>
    |               ^^^^ Object literal may only specify known properties, and '"mess"' does not exist in type 'Input'.
  2 | //                ^|
  3 |
  4 | <fancy-button on/>
```

### Ln 4, Col 15
```marko
  2 | //                ^|
  3 |
> 4 | <fancy-button on/>
    |               ^^ Object literal may only specify known properties, and '"on"' does not exist in type 'Input'.
  5 | //              ^|
  6 |
  7 | <div cla/>
```

### Ln 7, Col 6
```marko
   5 | //              ^|
   6 |
>  7 | <div cla/>
     |      ^^^ Object literal may only specify known properties, and '"cla"' does not exist in type 'Div'.
   8 | //      ^|
   9 |
  10 | <div id:s/>
```

### Ln 13, Col 9
```marko
  11 | //       ^|
  12 |
> 13 | <button type="su"/>
     |         ^^^^ Type '"su"' is not assignable to type '"button" | "submit" | "reset"'.
  14 | //              ^|
  15 |
```

### Ln 13, Col 2
```marko
  11 | //       ^|
  12 |
> 13 | <button type="su"/>
     |  ^^^^^^ Fix any of the following:
  Element does not have inner text that is visible to screen readers
  aria-label attribute does not exist or is empty
  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
  Element has no title attribute
  Element does not have an implicit (wrapped) <label>
  Element does not have an explicit <label>
  Element's default semantics were not overridden with role="none" or role="presentation"
  14 | //              ^|
  15 |
```

