import type { ReactNode } from "react"

import { usePrefersReducedMotion } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * The bag explainer.
 *
 * Three forms on the left (their field lines differ a little — that is the point), one
 * bucket in the middle, one destination on the right. Submissions drop into the bucket as
 * plain dots; what leaves is a single stamped dot, always the same. Many in, one shape out.
 *
 * Quiet on purpose: hairlines, the app's neutrals, and the wax-seal red only on the postmark
 * and the outgoing dot. Motion is SMIL `animateMotion` along the same lines the diagram
 * already draws, so the still picture (reduced motion, screenshots) tells the same story.
 * The postmark brightens on each arrival via CSS (`.bag-explainer-stamp`, styles/index.css).
 */

const LOOP_SECONDS = 4.8
const IN_DELAYS = [0, 0.8, 1.6] as const
const OUT_OFFSET = 1.3

const FORM_X = 40
const FORM_W = 88
const FORM_H = 32
const FORM_CY = [56, 100, 144] as const
const FORM_LINES: readonly (readonly [number, number])[] = [
  [40, 24],
  [30, 48],
  [46, 34],
]

/** The vessel: a wide, shallow bowl — a big elliptical mouth drawn in light perspective so
 * there is visibly an *inside* for things to fall into, and a round belly underneath. */
const VESSEL = { cx: 320, rimY: 74, rx: 46, ry: 10, bottomY: 134 }
const OUT_PATH = `M ${VESSEL.cx + VESSEL.rx - 4} 100 L 504 100`
const DEST = { x: 512, cy: 100 }

/** Arcs over from the form and comes straight down into the mouth (vertical tangent at the
 * end — the last control point sits directly above the mouth). */
function inGuide(cy: number): string {
  return `M ${FORM_X + FORM_W + 4} ${cy} C 236 ${cy}, ${VESSEL.cx} 36, ${VESSEL.cx} ${VESSEL.rimY - 8}`
}
/** The animated dot keeps going a little further — down through the opening. */
function inFlight(cy: number): string {
  return `${inGuide(cy)} L ${VESSEL.cx} ${VESSEL.rimY + VESSEL.ry}`
}

const STAMP_TICKS = Array.from({ length: 12 }, (_, i) => i)

export function BagFlowIllustration({ className }: { readonly className?: string }) {
  const reducedMotion = usePrefersReducedMotion()
  const dur = `${LOOP_SECONDS}s`
  const { cx, rimY, rx, ry, bottomY } = VESSEL
  const left = cx - rx
  const right = cx + rx

  return (
    <svg
      viewBox="0 20 640 156"
      role="img"
      aria-label="Three different forms feed one container; one identical, stamped result leaves it for a destination."
      className={cn("h-auto w-full select-none", className)}
      fill="none"
    >
      {/* lines — the still version of the story */}
      <g stroke="var(--border)" strokeWidth="1.25">
        {FORM_CY.map((cy) => (
          <path key={cy} d={inGuide(cy)} />
        ))}
        <path d={OUT_PATH} />
      </g>

      {/* forms */}
      {FORM_CY.map((cy, i) => {
        const top = cy - FORM_H / 2
        const [a, b] = FORM_LINES[i] ?? [40, 30]
        return (
          <g key={cy}>
            <rect x={FORM_X} y={top} width={FORM_W} height={FORM_H} rx="6" fill="var(--card)" stroke="var(--border)" strokeWidth="1.25" />
            <g stroke="var(--muted-foreground)" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round">
              <line x1={FORM_X + 12} y1={top + 12} x2={FORM_X + 12 + a} y2={top + 12} />
              <line x1={FORM_X + 12} y1={top + 20} x2={FORM_X + 12 + b} y2={top + 20} />
            </g>
          </g>
        )
      })}

      {/* vessel body + the back half of the rim (dots pass in front of these…) */}
      <g stroke="var(--foreground)" strokeOpacity="0.55">
        <path
          d={`M${left} ${rimY} C${left} ${bottomY}, ${right} ${bottomY}, ${right} ${rimY}`}
          fill="var(--muted)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d={`M${left} ${rimY} A${rx} ${ry} 0 0 1 ${right} ${rimY}`} strokeWidth="1.25" strokeOpacity="0.35" />
        {/* postmark — the stamp each arrival gets */}
        <g className="bag-explainer-stamp" stroke="var(--primary)" strokeOpacity="1">
          <circle cx={cx} cy="104" r="11" strokeWidth="1.3" />
          <circle cx={cx} cy="104" r="7.5" strokeWidth="0.9" opacity="0.7" />
          {STAMP_TICKS.map((i) => (
            <line
              key={i}
              x1={cx}
              y1="94.2"
              x2={cx}
              y2="96.4"
              strokeWidth="1.1"
              strokeLinecap="round"
              transform={`rotate(${(360 / STAMP_TICKS.length) * i} ${cx} 104)`}
            />
          ))}
          <circle cx={cx} cy="104" r="1.6" fill="var(--primary)" stroke="none" />
        </g>
      </g>

      {/* in — dots arc over and drop through the opening */}
      {!reducedMotion &&
        FORM_CY.map((cy, i) => (
          <g key={cy} opacity="0">
            <circle r="3.5" fill="var(--muted-foreground)" />
            <animateMotion
              dur={dur}
              begin={`${IN_DELAYS[i] ?? 0}s`}
              repeatCount="indefinite"
              path={inFlight(cy)}
              keyPoints="0;1;1"
              keyTimes="0;0.26;1"
              calcMode="spline"
              keySplines="0.3 0.9 0.4 1;0 0 1 1"
            />
            <animate attributeName="opacity" dur={dur} begin={`${IN_DELAYS[i] ?? 0}s`} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.03;0.235;0.26;1" />
          </g>
        ))}

      {/* …and the front half of the rim sits over them, so they visibly go inside */}
      <path d={`M${left} ${rimY} A${rx} ${ry} 0 0 0 ${right} ${rimY}`} stroke="var(--foreground)" strokeOpacity="0.55" strokeWidth="1.5" fill="var(--muted)" />

      {/* out — one stamped result per arrival */}
      {!reducedMotion &&
        IN_DELAYS.map((delay) => (
          <g key={delay} opacity="0">
            <circle r="3.5" fill="var(--primary)" />
            <animateMotion
              dur={dur}
              begin={`${delay + OUT_OFFSET}s`}
              repeatCount="indefinite"
              path={OUT_PATH}
              keyPoints="0;1;1"
              keyTimes="0;0.2;1"
              calcMode="spline"
              keySplines="0.22 1 0.36 1;0 0 1 1"
            />
            <animate attributeName="opacity" dur={dur} begin={`${delay + OUT_OFFSET}s`} repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.03;0.17;0.2;1" />
          </g>
        ))}

      {/* destination — the one shape, wherever it goes */}
      <g>
        <rect x={DEST.x} y={DEST.cy - FORM_H / 2} width={FORM_W} height={FORM_H} rx="6" fill="var(--card)" stroke="var(--border)" strokeWidth="1.25" />
        <circle cx={DEST.x + 16} cy={DEST.cy} r="3.5" fill="var(--primary)" />
        <g stroke="var(--muted-foreground)" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round">
          <line x1={DEST.x + 26} y1={DEST.cy - 4} x2={DEST.x + 70} y2={DEST.cy - 4} />
          <line x1={DEST.x + 26} y1={DEST.cy + 4} x2={DEST.x + 56} y2={DEST.cy + 4} />
        </g>
      </g>
    </svg>
  )
}

const STEPS: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: "Attach a form.",
    body: "The first one sets the bag's shape — Postbag copies its fields. Nothing to write.",
  },
  {
    title: "Attach the rest, match the fields.",
    body: "“name” on one site, “fullName” on another: point them at the same slot. Required fields that are still empty get flagged right away.",
  },
  {
    title: "Send the bag somewhere.",
    body: "One route for all of them — email, Telegram, a webhook — instead of one per form.",
  },
]

/** The plain-language version of "what is this screen". Used as the empty state of the Bags
 * list and of a fresh bag's Sources tab. `action` is the one thing to do next; `aside` is the
 * honest escape hatch ("you might not need this"). */
export function BagExplainer({
  title,
  lede,
  action,
  aside,
  className,
}: {
  readonly title: string
  readonly lede: string
  readonly action?: ReactNode
  readonly aside?: ReactNode
  readonly className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-(--duration-medium)",
        className,
      )}
    >
      <div className="border-b border-border/70 bg-background/60 px-4 py-3 sm:px-8">
        <BagFlowIllustration className="mx-auto max-w-xl" />
      </div>
      <div className="grid gap-8 px-6 py-6 md:grid-cols-[1.1fr_1fr] md:px-8">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">What a bag does</p>
          <h2 className="text-xl font-semibold tracking-tight text-balance">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{lede}</p>
          {action !== undefined && <div className="mt-2">{action}</div>}
          {aside !== undefined && <p className="text-xs text-muted-foreground text-pretty">{aside}</p>}
        </div>
        <ol className="flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent font-mono text-xs font-medium text-accent-foreground tabular-nums"
              >
                {i + 1}
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground text-pretty">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
