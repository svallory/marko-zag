import type { MachineSrc, StateMachine as S } from "@zag-js/core";
import { HookOptions } from "../types";

export const getService = <
  TContext extends Record<string, any>,
  TState extends S.StateSchema,
  TEvent extends S.EventObject = S.AnyEventObject,
>(
  machine: MachineSrc<TContext, TState, TEvent>,
  options?: HookOptions<TContext, TState, TEvent>,
) => {
  const _machine = typeof machine === "function" ? machine() : machine;
  const result = options?.context
    ? _machine.withContext(options?.context)
    : _machine;
  return () => result;
};