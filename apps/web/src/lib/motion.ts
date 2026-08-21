import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => {
    media.removeEventListener("change", onChange)
  }
}

/** True when the OS asks for reduced motion. CSS animations honour the media query on their
 * own; this is for the few places (SMIL, JS-driven sequences) that can't. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}
