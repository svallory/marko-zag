import type { StateMachine as S } from "@zag-js/core";

export type RSA = Record<string, any>;
export type SSS = S.StateSchema;
export type SEO = S.EventObject;
export type SAEO = S.AnyEventObject;

export type HookOptions<
  TContext extends Record<string, any>,
  TState extends S.StateSchema,
  TEvent extends S.EventObject = S.AnyEventObject,
> = Omit<S.HookOptions<TContext, TState, TEvent>, "context"> & {
  context?: Partial<TContext>;
};