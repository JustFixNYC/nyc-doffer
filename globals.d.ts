declare namespace Intl {
  // At the time of writing Intl.RelativeTimeFormat is a draft standard, so
  // TypeScript doesn't include it in its types, but it is available in node 12.
  //
  // Note that we're only defining the subset of types that we actually use here,
  // they are not exhaustive.
  class RelativeTimeFormat {
    constructor(locale: string);

    format(value: number, unit: 'second'): string;
  }
}
