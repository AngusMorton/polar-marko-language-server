## Hovers
### Ln 1, Col 16
```marko
> 1 | <fancy-button label="hi" size="lg" onSelect() {}/>
    |                ^ `label?: string`

The button label.

*@deprecated* — Use the `content` body instead.

*@default*  
```
"Submit"
```
  2 | //             ^?         ^?        ^?
  3 |
  4 | <fancy-button lab/>
```

### Ln 1, Col 27
```marko
> 1 | <fancy-button label="hi" size="lg" onSelect() {}/>
    |                           ^ `size?: "lg" | "sm"`

Visual size of the button.

*@example*  
```
<fancy-button size="lg"/>
```

*@see* — https://example.com/buttons

Values: `lg`, `sm`
  2 | //             ^?         ^?        ^?
  3 |
  4 | <fancy-button lab/>
```

### Ln 1, Col 37
```marko
> 1 | <fancy-button label="hi" size="lg" onSelect() {}/>
    |                                     ^ `onSelect: (value: string): void`

Fired when the button is selected.

*@deprecated* — Listen for `onActivate` instead.
  2 | //             ^?         ^?        ^?
  3 |
  4 | <fancy-button lab/>
```

## Completions
### Ln 4, Col 18
```marko
  2 | //             ^?         ^?        ^?
  3 |
> 4 | <fancy-button lab/>
    |                  ^ cursor
  5 | //               ^|
  6 |
```

1. `label?` (Field) [deprecated]
   newText: `label="$1"$0`
   documentation: \`label?: string\` The button label. *@deprecated* — Use the \`content\` body instead. *@default* \`\`\` "Submit" \`\`\`

## Diagnostics
### Ln 4, Col 15
```marko
  2 | //             ^?         ^?        ^?
  3 |
> 4 | <fancy-button lab/>
    |               ^^^ Object literal may only specify known properties, and '"lab"' does not exist in type 'Input'.
  5 | //               ^|
  6 |
```

