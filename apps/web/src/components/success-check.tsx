import { useLayoutEffect, useRef, useState } from "react"

/** transitions-dev success check, calibrated dynamically (`getTotalLength`) since this
 * icon is a fixed shape. Fade + rotate + blur + Y-bob + stroke-draw, in parallel. */
export function SuccessCheck({ show, size = 18, className }: { readonly show: boolean; readonly size?: number; readonly className?: string }) {
  const pathRef = useRef<SVGPathElement>(null)
  const [state, setState] = useState<"in" | "out">("out")

  useLayoutEffect(() => {
    const path = pathRef.current
    if (path !== null) {
      const length = Math.ceil(path.getTotalLength()) + 1
      path.style.strokeDasharray = String(length)
      path.style.strokeDashoffset = show ? "0" : String(length)
    }
    if (show) {
      setState("out")
      requestAnimationFrame(() => {
        setState("in")
      })
    } else {
      setState("out")
    }
  }, [show])

  return (
    <span className={className} data-state={state} aria-hidden="true" style={{ display: show ? "inline-block" : "none" }}>
      <span className="t-success-check" data-state={state}>
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path ref={pathRef} d="M4 12.5L9.5 18L20 6" />
        </svg>
      </span>
    </span>
  )
}
