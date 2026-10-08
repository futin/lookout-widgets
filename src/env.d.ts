// The two runtime globals src uses, declared narrowly: tsconfig keeps `types: []` (no @types/node, no DOM lib) so src cannot lean on anything else.
// Not emitted — a consumer's emitted .d.ts resolves these from its own Node or DOM types.
declare class URLSearchParams {
  constructor(init?: string | Record<string, string>);
  get(name: string): string | null;
}
declare var console: { warn(...args: unknown[]): void };
