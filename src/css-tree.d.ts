/**
 * Type declarations for css-tree
 * css-tree doesn't ship with TypeScript types, so we provide minimal types here
 */

declare module 'css-tree' {
  export interface CssNode {
    type: string;
    [key: string]: any;
  }

  export interface ParseOptions {
    parseAtrulePrelude?: boolean;
    parseRulePrelude?: boolean;
    parseValue?: boolean;
    positions?: boolean;
  }

  export function parse(css: string, options?: ParseOptions): CssNode;
  export function walk(ast: CssNode, callback: (node: CssNode) => void): void;
}

