## Document Symbols
1. `div`
```marko
  3 | }
  4 |
> 5 | <div>
    |  ^^^ symbol
  6 |   <h1>Title</h1>
  7 |   <fancy-button>
  8 |     <@icon name="search" />
```
  1.1. `h1`
```marko
  4 |
  5 | <div>
> 6 |   <h1>Title</h1>
    |    ^^ symbol
  7 |   <fancy-button>
  8 |     <@icon name="search" />
  9 |   </fancy-button>
```
  1.2. `fancy-button`
```marko
   5 | <div>
   6 |   <h1>Title</h1>
>  7 |   <fancy-button>
     |    ^^^^^^^^^^^^ symbol
   8 |     <@icon name="search" />
   9 |   </fancy-button>
  10 | </div>
```
    1.2.1. `@icon`
```marko
   6 |   <h1>Title</h1>
   7 |   <fancy-button>
>  8 |     <@icon name="search" />
     |      ^^^^^ symbol
   9 |   </fancy-button>
  10 | </div>
  11 |
```
2. `if`
```marko
  10 | </div>
  11 |
> 12 | <if(input.show)>
     |  ^^ symbol
  13 |   <span>Visible</span>
  14 | </if>
  15 |
```
  2.1. `span`
```marko
  11 |
  12 | <if(input.show)>
> 13 |   <span>Visible</span>
     |    ^^^^ symbol
  14 | </if>
  15 |
```

