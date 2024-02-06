import type { MachineSrc, StateMachine as S, Machine } from "@zag-js/core";
import type { MachineOptions } from "../types";

export const getService = <
  TContext extends Record<string, any>,
  TState extends S.StateSchema,
  TEvent extends S.EventObject = S.AnyEventObject,
>(
  machine: MachineSrc<TContext, TState, TEvent>,
  options?: MachineOptions<TContext, TState, TEvent>,
) => {
  const _machine = typeof machine === "function" ? machine() : machine;
  const result = options?.context
    ? (_machine as any).withContext(options?.context)
    : _machine;
  return () => result as Machine<TContext, TState, TEvent>;
};
