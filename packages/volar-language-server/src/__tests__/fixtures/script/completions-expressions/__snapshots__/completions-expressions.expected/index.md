## Completions
### Ln 3, Col 15
```marko
  1 | static const submitValue = "submit";
  2 |
> 3 | <button type=su/>
    |               ^ cursor
  4 | //            ^|
  5 |
  6 | <div>${su}</div>
```

1. `state`
2. `submitValue`
3. `Sanitizer`
4. `satisfies`

### Ln 6, Col 10
```marko
  4 | //            ^|
  5 |
> 6 | <div>${su}</div>
    |          ^ cursor
  7 | //       ^|
  8 |
```

1. `submitValue`
2. `SubmitEvent`
3. `SubtleCrypto`
4. `super`

## Diagnostics
### Ln 1, Col 14
```marko
> 1 | static const submitValue = "submit";
    |              ^^^^^^^^^^^ 'submitValue' is declared but its value is never read.
  2 |
  3 | <button type=su/>
  4 | //            ^|
```

### Ln 3, Col 14
```marko
  1 | static const submitValue = "submit";
  2 |
> 3 | <button type=su/>
    |              ^^ Cannot find name 'su'.
  4 | //            ^|
  5 |
  6 | <div>${su}</div>
```

### Ln 6, Col 8
```marko
  4 | //            ^|
  5 |
> 6 | <div>${su}</div>
    |        ^^ Cannot find name 'su'.
  7 | //       ^|
  8 |
```

### Ln 3, Col 2
```marko
  1 | static const submitValue = "submit";
  2 |
> 3 | <button type=su/>
    |  ^^^^^^ Fix any of the following:
  Element does not have inner text that is visible to screen readers
  aria-label attribute does not exist or is empty
  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty
  Element has no title attribute
  Element does not have an implicit (wrapped) <label>
  Element does not have an explicit <label>
  Element's default semantics were not overridden with role="none" or role="presentation"
  4 | //            ^|
  5 |
  6 | <div>${su}</div>
```

