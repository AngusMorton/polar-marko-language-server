## Document Symbols
1. `list`
```marko
> 1 | <list>
    |  ^^^^ symbol
  2 |   <@a>
  3 |     <for of=[1, 2, 3]>
  4 |       <@b size="small"/>
```
  1.1. `@a`
```marko
  1 | <list>
> 2 |   <@a>
    |    ^^ symbol
  3 |     <for of=[1, 2, 3]>
  4 |       <@b size="small"/>
  5 |     </for>
```
    1.1.1. `for`
```marko
  1 | <list>
  2 |   <@a>
> 3 |     <for of=[1, 2, 3]>
    |      ^^^ symbol
  4 |       <@b size="small"/>
  5 |     </for>
  6 |   </>
```
      1.1.1.1. `@b`
```marko
  2 |   <@a>
  3 |     <for of=[1, 2, 3]>
> 4 |       <@b size="small"/>
    |        ^^ symbol
  5 |     </for>
  6 |   </>
  7 | </list>
```

