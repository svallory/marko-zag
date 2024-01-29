import type {
  StateMachine,
  Machine,
  MachineSrc,
  StateMachine as S,
} from "@zag-js/core";

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

declare function mergeProps<T extends Record<string, any>>(
  ...sources: T[]
): UnionToIntersection<TupleTypes<T[]>>;

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
export type HookOptions<
  TContext extends Record<string, any>,
  TState extends StateMachine.StateSchema,
  TEvent extends StateMachine.EventObject = StateMachine.AnyEventObject,
> = Omit<StateMachine.HookOptions<TContext, TState, TEvent>, "context"> & {
  context?: ReactiveOrTracked<TContext>;
};

/**
 * When implementing a new adapter,
 * you can use the `createNormalizer<TProps>` from "@zag-js/types"
 * to create this object
 */
// declare const normalizeProps: NormalizeProps<PropTypes>;

// useActor hook
declare function useActor<
  TContext extends Record<string, any>,
  TState extends StateMachine.StateSchema,
  TEvent extends StateMachine.EventObject = StateMachine.AnyEventObject,
>(
  service: Machine<TContext, TState, TEvent>,
): readonly [
  StateMachine.State<TContext, TState, TEvent>,
  (evt: StateMachine.Event<TEvent>) => void,
];

declare function useService<
  TContext extends Record<string, any>,
  TState extends StateMachine.StateSchema,
  TEvent extends StateMachine.EventObject = StateMachine.AnyEventObject,
>(
  machine: MachineSrc<TContext, TState, TEvent>,
  options?: StateMachine.MachineOptions<TContext, TState, TEvent>,
): Machine<TContext, TState, TEvent>;

declare function useSnapshot<
  TContext extends Record<string, any>,
  TState extends StateMachine.StateSchema,
  TEvent extends StateMachine.EventObject = StateMachine.AnyEventObject,
>(
  service: Machine<TContext, TState, TEvent>,
  options?: StateMachine.MachineOptions<TContext, TState, TEvent>,
): ReactiveOrTracked<StateMachine.State<TContext, TState, TEvent>>;

// useMachine hook with generic MachineOptions
declare function useMachine<
  TContext extends Record<string, any>,
  TState extends StateMachine.StateSchema,
  TEvent extends StateMachine.EventObject = StateMachine.AnyEventObject,
>(
  machine: MachineSrc<TContext, TState, TEvent>,
  options?: StateMachine.MachineOptions<TContext, TState, TEvent>,
): readonly [
  StateMachine.State<TContext, TState, TEvent>,
  (evt: StateMachine.Event<TEvent>) => void,
  Machine<TContext, TState, TEvent>,
];

export type { mergeProps, useActor, useMachine, useService, useSnapshot };
