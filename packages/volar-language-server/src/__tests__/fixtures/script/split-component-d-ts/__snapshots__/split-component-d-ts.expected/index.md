## Hovers
### Ln 1, Col 15
```marko
> 1 | <fancy-button color="red" fanciness=5/>
    |               ^ `color?: string`
  2 | //            ^?          ^?
  3 |
  4 | <regular-button size="large">body</regular-button>
```

### Ln 1, Col 27
```marko
> 1 | <fancy-button color="red" fanciness=5/>
    |                           ^ `fanciness?: number`
  2 | //            ^?          ^?
  3 |
  4 | <regular-button size="large">body</regular-button>
```

### Ln 4, Col 17
```marko
  2 | //            ^?          ^?
  3 |
> 4 | <regular-button size="large">body</regular-button>
    |                 ^ `size?: "large" | "small"`

Values: `large`, `small`
  5 | //              ^?
  6 |
```

