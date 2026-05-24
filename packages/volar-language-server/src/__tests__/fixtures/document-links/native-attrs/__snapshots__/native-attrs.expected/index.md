## Document Links
1. components/fancy-button/index.marko
```marko
> 1 | import FancyButton from "<fancy-button>";
    |                         ^^^^^^^^^^^^^^^^ link
  2 |
  3 | <a href="./linked.txt">Link</a>
  4 | <a id="section-anchor"></a>
```
2. linked.txt
```marko
  1 | import FancyButton from "<fancy-button>";
  2 |
> 3 | <a href="./linked.txt">Link</a>
    |         ^^^^^^^^^^^^^^ link
  4 | <a id="section-anchor"></a>
  5 | <a href="#section-anchor">Section</a>
  6 | <A HREF="./linked.txt">Uppercase</A>
```
3. index.marko#section-anchor
```marko
  3 | <a href="./linked.txt">Link</a>
  4 | <a id="section-anchor"></a>
> 5 | <a href="#section-anchor">Section</a>
    |         ^^^^^^^^^^^^^^^^^ link
  6 | <A HREF="./linked.txt">Uppercase</A>
  7 | <a href="https://markojs.com/docs/linked.txt#hash">Hash</a>
  8 | <a href="https://markojs.com/docs/foo(bar).txt">Parens</a>
```
4. linked.txt
```marko
   7 | <a href="https://markojs.com/docs/linked.txt#hash">Hash</a>
   8 | <a href="https://markojs.com/docs/foo(bar).txt">Parens</a>
>  9 | <img src="./linked.txt" alt="Linked image">
     |          ^^^^^^^^^^^^^^ link
  10 | <video poster="./linked.txt"></video>
  11 | <object data="./linked.txt"></object>
  12 | <form action="./linked.txt"></form>
```
5. linked.txt
```marko
   8 | <a href="https://markojs.com/docs/foo(bar).txt">Parens</a>
   9 | <img src="./linked.txt" alt="Linked image">
> 10 | <video poster="./linked.txt"></video>
     |               ^^^^^^^^^^^^^^ link
  11 | <object data="./linked.txt"></object>
  12 | <form action="./linked.txt"></form>
  13 | <blockquote cite="./linked.txt"></blockquote>
```
6. linked.txt
```marko
   9 | <img src="./linked.txt" alt="Linked image">
  10 | <video poster="./linked.txt"></video>
> 11 | <object data="./linked.txt"></object>
     |              ^^^^^^^^^^^^^^ link
  12 | <form action="./linked.txt"></form>
  13 | <blockquote cite="./linked.txt"></blockquote>
  14 | <button formaction="./linked.txt">Submit</button>
```

