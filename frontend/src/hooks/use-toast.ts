"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type { ToastProps } from "@/components/ui/toast"
import { ToastAction } from "@/components/ui/toast"

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1000000

type ToasterToast = Omit<ToastProps, "title"> & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">
type ToastActionConfig = {
  label: React.ReactNode
  onClick?: () => void
  altText?: string
}
type ToastInput = Toast | React.ReactNode
type ToastOptions = Omit<Toast, "title" | "action"> & {
  action?: React.ReactNode | ToastActionConfig
}

const isToastConfig = (value: ToastInput): value is Toast =>
  typeof value === "object" && value !== null && !React.isValidElement(value)

const isToastActionConfig = (
  action: React.ReactNode | ToastActionConfig
): action is ToastActionConfig =>
  typeof action === "object" &&
  action !== null &&
  "label" in action

const normalizeAction = (
  action?: React.ReactNode | ToastActionConfig
): React.ReactNode | undefined => {
  if (!action) return undefined
  if (React.isValidElement(action) || !isToastActionConfig(action)) return action

  return React.createElement(
    ToastAction,
    {
      altText: action.altText ?? String(action.label),
      onClick: action.onClick,
    },
    action.label
  )
}

const normalizeToast = (input: ToastInput, options?: ToastOptions): Toast => {
  if (isToastConfig(input)) {
    return {
      ...input,
      action: normalizeAction(input.action),
    }
  }

  return {
    ...options,
    title: input as React.ReactNode,
    action: normalizeAction(options?.action),
  }
}

function baseToast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

type ToastFn = {
  (props: Toast): ReturnType<typeof baseToast>
  (title: React.ReactNode, options?: ToastOptions): ReturnType<typeof baseToast>
  success: (title: React.ReactNode, options?: ToastOptions) => ReturnType<typeof baseToast>
  error: (title: React.ReactNode, options?: ToastOptions) => ReturnType<typeof baseToast>
  info: (title: React.ReactNode, options?: ToastOptions) => ReturnType<typeof baseToast>
}

const toast = ((input: ToastInput, options?: ToastOptions) =>
  baseToast(normalizeToast(input, options))) as ToastFn

toast.success = (title, options) => toast(title, options)
toast.info = (title, options) => toast(title, options)
toast.error = (title, options) =>
  toast(title, {
    ...options,
    variant: "destructive",
  })

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
