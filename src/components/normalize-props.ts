import { createNormalizer } from "@zag-js/types"
import { isString } from "@zag-js/utils"

export type PropTypes<T = Dict> = Record<"button" | "label" | "input" | "textarea" | "img" | "output" | "element" | "select" | "style" | "circle" | "svg", T>;

const eventMap: Record<string, string> = {
  className: "class",
  defaultChecked: "checked",
  defaultValue: "value",
  htmlFor: "for",
  // onBlur: "onFocusout",
  // onCompositionEnd: "onCompositionend",
  // onCompositionStart: "onCompositionstart",
  // onContextMenu: "onContextmenu",
  // onDoubleClick: "onDblclick",
  // onDragStart: "onDragstart",
  // onFocus: "onFocusin",
  // onKeyDown: "onKeydown",
  // onKeyUp: "onKeyup",
  // onPointerCancel: "onPointercancel",
  // onPointerDown: "onPointerdown",
  // onPointerEnter: "onPointerenter",
  // onPointerLeave: "onPointerleave",
  // onPointerMove: "onPointermove",
  // onPointerUp: "onPointerup",
}

function camelToKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2") // Insert a dash between lower and upper case characters
    .replace(/[\s_]+/g, "-") // Replace whitespace and underscores with dashes
    .toLowerCase() // Convert everything to lower case
}

function toMarkoProp(prop: string) {
  return prop in eventMap ? eventMap[prop] : prop
}

type Dict = Record<string, any>

function wrapHandler(handlerFn: Function) {
  return (...args: any[]) => {
    // console.log("Event handler", handlerFn.name, "called")
    if ("currentTarget" in args[0]) {
      const originalEvent = args.shift()

      const fakeEvent: Record<string, any> = {}

      for (let prop in originalEvent) {
        if (typeof originalEvent[prop] === "function") {
          fakeEvent[prop] = originalEvent[prop].bind(originalEvent)
        } else {
          fakeEvent[prop] = originalEvent[prop]
        }
      }

      // muda o evento
      fakeEvent.currentTarget = originalEvent.target

      if (originalEvent.type === "click") {
        console.log("originalEvent spread", { ...originalEvent })
        console.log("originalEvent.currentTarget", originalEvent.currentTarget)
        console.log("originalEvent.target", originalEvent.target)
        console.log("fakeEvent", fakeEvent)
      }

      return handlerFn(fakeEvent, ...args)
    }

    return handlerFn(...args)
  }
}

export const normalizeProps = createNormalizer<PropTypes>((props: Dict) => {
  const normalized: Dict = {}

  for (const key in props) {
    const value = props[key]

    if (key.startsWith("on") && typeof value === "function") {
      normalized[key] = wrapHandler(value)
      // if (key == "onClick") {
      //   console.log("click:", props[key].toString(), normalized[camelToKebabCase(key)].toString())
      // }
      continue
    }

    if (key === "children") {
      if (isString(value)) {
        normalized["textContent"] = value
      }
      continue
    }

    normalized[toMarkoProp(key)] = value
  }

  // console.table({ from: Object.keys(props), to: Object.keys(normalized) })

  return normalized
})
