import { buildSearchParams } from "./searchParams";

export type RoutePath = MarkoRun.Route["path"];

export type RouteParams<Path extends RoutePath> = (MarkoRun.Route & {
  path: Path;
})["params"];

export type BuildPathArgs<Path extends RoutePath> =
  keyof RouteParams<Path> extends never
    ? {
        path: Path;
        params?: RouteParams<Path>;
        query?: Record<string, unknown>;
      }
    : {
        path: Path;
        params: RouteParams<Path>;
        query?: Record<string, unknown>;
      };

export const buildPath = <Path extends RoutePath>({
  params,
  path,
  query,
}: BuildPathArgs<Path>) => {
  const base = Object.entries(params || {}).reduce<string>(
    (prev, [param, value]) => prev.replaceAll(`:${param}`, value as string),
    path,
  );
  return query ? `${base}?${buildSearchParams(query)}` : base;
};