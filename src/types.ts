export interface Point {
  x: number;
  y: number;
}

declare const __cell: unique symbol;
declare const __pixel: unique symbol;
declare const __direction: unique symbol;

export type Cell = Point & { readonly [__cell]: true };
export type Pixel = Point & { readonly [__pixel]: true };
export type Direction = Point & { readonly [__direction]: true };
export type Rect<P extends Point = Point> = P & {
  width: number;
  height: number;
};
