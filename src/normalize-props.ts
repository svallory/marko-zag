import { createNormalizer, type NormalizeProps } from "@zag-js/types";
import { isString } from "@zag-js/utils";

export type PropTypes<TComponent = any> = Marko.Input<TComponent>;

const eventMap: Record<string, string> = {
  className: "class",
  defaultChecked: "checked",
  defaultValue: "value",
  htmlFor: "for",
};

function toMarkoProp(prop: string) {
  return prop in eventMap ? eventMap[prop] : prop;
}

type Dict<T = any> = Record<string, T>;

function wrapHandler(handlerFn: (...params: any[]) => unknown) {
  return (...args: any[]) => {
    if ("currentTarget" in args[0]) {
      const originalEvent = args.shift();

      const fakeEvent: Record<string, any> = {};

      for (const prop in originalEvent) {
        if (typeof originalEvent[prop] === "function") {
          fakeEvent[prop] = originalEvent[prop].bind(originalEvent);
        } else {
          fakeEvent[prop] = originalEvent[prop];
        }
      }

      // Create fake event
      fakeEvent.currentTarget = originalEvent.target;

      return handlerFn(fakeEvent, ...args);
    }

    return handlerFn(...args);
  };
}

export const normalizeProps: NormalizeProps<PropTypes> =
  createNormalizer<PropTypes>((props: Dict) => {
    const normalized: Dict = {};

    for (const key in props) {
      const value = props[key];

      if (key.startsWith("on") && typeof value === "function") {
        normalized[key] = wrapHandler(value);
        continue;
      }

      if (key === "children") {
        if (isString(value)) {
          normalized["textContent"] = value;
        }
        continue;
      }

      normalized[toMarkoProp(key)] = value;
    }

    return normalized;
  });
