export interface Input<TData = string> {
  renderBody: Marko.Body<[TData], void>;
  value?: () => TData;
  key?: string;
}
abstract class Component<TData = string> extends Marko.Component<
  Input<TData>
> {}
export { type Component };
(function <TData = string>(this: void) {
  const input = Marko._.any as Input<TData>;
  const component = Marko._.any as Component<TData>;
  const state = Marko._.state(component);
  const out = Marko._.out;
  const $signal = Marko._.any as AbortSignal;
  const $global = Marko._.getGlobal(
    // @ts-expect-error We expect the compiler to error because we are checking if the MarkoRun.Context is defined.
    (Marko._.error, Marko._.any as MarkoRun.Context),
  );
  Marko._.noop({ component, state, out, input, $global, $signal });
  return;
})();
export default new (class Template extends Marko._.Template<{
  render<TData = string>(
    input: Marko.TemplateInput<Input<TData>>,
    stream?: {
      write: (chunk: string) => void;
      end: (chunk?: string) => void;
    },
  ): Marko.Out<Component<TData>>;

  render<TData = string>(
    input: Marko.TemplateInput<Input<TData>>,
    cb?: (
      err: Error | null,
      result: Marko.RenderResult<Component<TData>>,
    ) => void,
  ): Marko.Out<Component<TData>>;

  renderSync<TData = string>(
    input: Marko.TemplateInput<Input<TData>>,
  ): Marko.RenderResult<Component<TData>>;

  renderToString<TData = string>(
    input: Marko.TemplateInput<Input<TData>>,
  ): string;

  stream<TData = string>(
    input: Marko.TemplateInput<Input<TData>>,
  ): ReadableStream<string> & NodeJS.ReadableStream;

  mount<TData = string>(
    input: Marko.TemplateInput<Input<TData>>,
    reference: Node,
    position?: "afterbegin" | "afterend" | "beforebegin" | "beforeend",
  ): Marko.MountedTemplate<typeof input>;

  api: "class";
  _<__marko_internal_apply = 1>(): __marko_internal_apply extends 0
    ? <TData = string>() => <__marko_internal_input extends unknown>(
        input: Marko.Directives &
          Input<TData> &
          Marko._.Relate<
            __marko_internal_input,
            Marko.Directives & Input<TData>
          >,
      ) => Marko._.ReturnWithScope<__marko_internal_input, void>
    : () => <__marko_internal_input extends unknown, TData = string>(
        input: Marko.Directives &
          Input<TData> &
          Marko._.Relate<
            __marko_internal_input,
            Marko.Directives & Input<TData>
          >,
      ) => Marko._.ReturnWithScope<__marko_internal_input, void>;
}> {})();
