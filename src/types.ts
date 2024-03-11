import type { Machine, MachineSrc, StateMachine as S } from "@zag-js/core";

export type RSA = Record<string, any>;
export type SSS = {
  value: string;
  tags?: string | undefined;
};
export type SEO = S.EventObject;
export type SAEO = S.AnyEventObject;
//
// ONLY HERE BECAUSE Zag DOES NOT EXPORT THEM
//
type IfEquals<X, Y, A, B> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? A : B;
type WritableKey<T> = {
  [P in keyof T]: IfEquals<
    { [Q in P]: T[P] },
    { -readonly [Q in P]: T[P] },
    P,
    never
  >;
}[keyof T];
export type Writable<T> = Pick<T, WritableKey<T>>;
export type UserContext<TContext> = Partial<Writable<TContext>>;

type TupleTypes<T extends any[]> = T[number];

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

//////////////////////////////////////////////////////////////////

export type mergeProps = <T extends Record<string, any>>(
  ...sources: T[]
) => UnionToIntersection<TupleTypes<T[]>>;

/**
 * In the end this is a Partial and Writeable
 */
type ReactiveOrTracked<TContext> = UserContext<TContext>;

/**
 * Generic HookOptions type
 *
 * This type should be customized in the adapter to set a more specific
 * type for the `context` argument
 *
 * Example:
 *
 * - Solid: `{ context?: Store<Partial<TContext>> | Accessor<Partial<TContext>> } & Omit<HookOptions<...>, "context">`
 * - Vue: `{ context?: Ref<S.UserContext<TContext>> | ComputedRef<S.UserContext<TContext>> } & Omit<HookOptions<...>, "context">`
 */
export type MachineOptions<
  TContext extends Record<string, any>,
  TState extends S.StateSchema,
  TEvent extends S.EventObject = S.AnyEventObject,
> = Omit<S.HookOptions<TContext, TState, TEvent>, "context"> & {
  context?: ReactiveOrTracked<TContext>;
};

/**
 * When implementing a new adapter,
 * you can use the `createNormalizer<TProps>` from "@zag-js/types"
 * to create this object
 */
// declare const normalizeProps: NormalizeProps<PropTypes>;

// useActor hook
export type useActor = <
  TContext extends Record<string, any>,
  TState extends S.StateSchema,
  TEvent extends S.EventObject = S.AnyEventObject,
>(
  service: Machine<TContext, TState, TEvent>,
) => readonly [S.State<TContext, TState, TEvent>, (evt: S.Event<TEvent>) => void];

export type useService = <
  TContext extends Record<string, any>,
  TState extends S.StateSchema,
  TEvent extends S.EventObject = S.AnyEventObject,
>(
  machine: MachineSrc<TContext, TState, TEvent>,
  options?: S.MachineOptions<TContext, TState, TEvent>,
) => Machine<TContext, TState, TEvent>;

export type useSnapshot = <
  TContext extends Record<string, any>,
  TState extends S.StateSchema,
  TEvent extends S.EventObject = S.AnyEventObject,
>(
  service: Machine<TContext, TState, TEvent>,
  options?: S.MachineOptions<TContext, TState, TEvent>,
) => ReactiveOrTracked<S.State<TContext, TState, TEvent>>;

// useMachine hook with generic MachineOptions
export type useMachine = <
  TContext extends Record<string, any>,
  TState extends S.StateSchema,
  TEvent extends S.EventObject = S.AnyEventObject,
>(
  machine: MachineSrc<TContext, TState, TEvent>,
  options?: S.MachineOptions<TContext, TState, TEvent>,
) => readonly [
  S.State<TContext, TState, TEvent>,
  (evt: S.Event<TEvent>) => void,
  Machine<TContext, TState, TEvent>,
];

// export type { mergeProps, useActor, useMachine, useService, useSnapshot };

export type Dict<T = any> = Record<string, T>;
export type State<TContext extends Dict, TState extends S.StateSchema = S.StateSchema, TEvent extends S.EventObject = S.EventObject> = S.State<TContext, TState, TEvent>;
export type Event<TEvent extends S.EventObject = S.EventObject> = TEvent | TEvent["type"];