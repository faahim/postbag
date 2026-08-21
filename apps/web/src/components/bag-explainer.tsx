import type { ReactNode } from "react"

import { usePrefersReducedMotion } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * The bag explainer — "the sorting office".
 *
 * Four forms on the left, each drawn a little differently (that is the point: same job,
 * different fields). Their submissions fly into one bag, the postmark stamps each arrival,
 * and one *identical* shape leaves for the destination on the right. Inputs vary, output
 * doesn't — that is everything a Bag is, shown rather than said.
 *
 * Motion is SMIL `animateMotion` along the same paths the dashed guides draw, so the
 * still picture (reduced motion, or a screenshot) already tells the story. The bag's
 * "breathe" and the stamp pulse are CSS keyframes timed to the four arrivals
 * (styles/index.css, `.bag-explainer-*`). Loop length lives in `--bag-loop`.
 */

const LOOP_SECONDS = 5.2
const IN_DELAYS = [0, 0.9, 1.8, 2.7] as const
const OUT_OFFSET = 1.55

type FormSketch = {
  readonly cy: number
  readonly lines: readonly number[]
  readonly button: boolean
  /** Width of the single line on the in-flight token — "this one's data is shaped like this". */
  readonly tokenLine: number
}

const FORMS: readonly FormSketch[] = [
  { cy: 38, lines: [48, 30], button: true, tokenLine: 7 },
  { cy: 88, lines: [34, 56, 42], button: false, tokenLine: 11 },
  { cy: 138, lines: [58, 26], button: true, tokenLine: 5 },
  { cy: 188, lines: [40, 40, 40], button: false, tokenLine: 9 },
]

const FORM_X = 28
const FORM_W = 84
const FORM_H = 44
const BAG_MOUTH = { x: 316, y: 70 }
const OUT_PATH = "M 362 168 C 418 178, 468 126, 546 126"

function inPath(cy: number): string {
  return `M ${FORM_X + FORM_W + 4} ${cy} C 204 ${cy}, 238 ${BAG_MOUTH.y}, ${BAG_MOUTH.x} ${BAG_MOUTH.y}`
}

const STAMP_TICKS = Array.from({ length: 12 }, (_, i) => i)

function Token({ line, stamped }: { readonly line: number; readonly stamped: boolean }) {
  return (
    <g>
      <rect
        x="-9"
        y="-6"
        width="18"
        height="12"
        rx="3"
        fill="var(--card)"
        stroke="var(--muted-foreground)"
        strokeOpacity="0.8"
        strokeWidth="1.2"
      />
      {stamped ? (
        <>
          <circle cx="-3.5" cy="0" r="2.4" fill="var(--primary)" />
          <line x1="1" y1="0" x2="6" y2="0" stroke="var(--muted-foreground)" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : (
        <line x1={-line / 2} y1="0" x2={line / 2} y2="0" stroke="var(--muted-foreground)" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </g>
  )
}

export function BagFlowIllustration({ className }: { readonly className?: string }) {
  const reducedMotion = usePrefersReducedMotion()
  const dur = `${LOOP_SECONDS}s`

  return (
    <svg
      viewBox="0 0 640 226"
      role="img"
      aria-label="Four different forms send submissions into one bag; one identical, stamped shape leaves it for a destination."
      className={cn("h-auto w-full select-none", className)}
      fill="none"
    >
      {/* guide paths — the still version of the story */}
      <g stroke="var(--border)" strokeWidth="1.25" strokeDasharray="3 4">
        {FORMS.map((f) => (
          <path key={f.cy} d={inPath(f.cy)} />
        ))}
        <path d={OUT_PATH} />
      </g>

      {/* forms — four sites, four slightly different forms */}
      {FORMS.map((f, index) => {
        const top = f.cy - FORM_H / 2
        return (
          <g key={f.cy}>
            <rect x={FORM_X} y={top} width={FORM_W} height={FORM_H} rx="6" fill="var(--card)" stroke="var(--border)" strokeWidth="1.25" />
            <g fill="var(--muted-foreground)" opacity="0.45">
              <circle cx={FORM_X + 9} cy={top + 8} r="1.6" />
              <circle cx={FORM_X + 15} cy={top + 8} r="1.6" />
              <circle cx={FORM_X + 21} cy={top + 8} r="1.6" />
            </g>
            {f.lines.map((w, i) => (
              <line
                key={i}
                x1={FORM_X + 9}
                y1={top + 18 + i * 7}
                x2={FORM_X + 9 + w}
                y2={top + 18 + i * 7}
                stroke="var(--muted-foreground)"
                strokeOpacity="0.45"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            ))}
            {f.button && (
              <rect x={FORM_X + 9} y={top + FORM_H - 11} width="20" height="5" rx="2.5" fill="var(--primary)" opacity="0.75" />
            )}
            {!reducedMotion && (
              <g opacity="0">
                <Token line={f.tokenLine} stamped={false} />
                <animateMotion
                  dur={dur}
                  begin={`${IN_DELAYS[index] ?? 0}s`}
                  repeatCount="indefinite"
                  path={inPath(f.cy)}
                  keyPoints="0;1;1"
                  keyTimes="0;0.25;1"
                  calcMode="spline"
                  keySplines="0.22 1 0.36 1;0 0 1 1"
                />
                <animate
                  attributeName="opacity"
                  dur={dur}
                  begin={`${IN_DELAYS[index] ?? 0}s`}
                  repeatCount="indefinite"
                  values="0;1;1;0;0"
                  keyTimes="0;0.03;0.21;0.25;1"
                />
              </g>
            )}
          </g>
        )
      })}

      {/* the bag */}
      <g className="bag-explainer-bag">
        <path
          d="M300 72 C 292 86, 268 110, 268 150 C 268 181, 290 193, 318 193 C 346 193, 368 181, 368 150 C 368 110, 344 86, 336 72 Z"
          fill="var(--muted)"
          stroke="var(--foreground)"
          strokeOpacity="0.6"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M298 70 Q318 60 338 70" stroke="var(--foreground)" strokeOpacity="0.6" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M300 80 Q318 90 336 80" stroke="var(--foreground)" strokeOpacity="0.35" strokeWidth="1.25" strokeLinecap="round" />
        {/* postmark — the stamp each arrival gets */}
        <g className="bag-explainer-stamp" stroke="var(--primary)" opacity="0.55">
          <circle cx="318" cy="142" r="15" strokeWidth="1.4" />
          <circle cx="318" cy="142" r="10.5" strokeWidth="1" opacity="0.7" />
          {STAMP_TICKS.map((i) => (
            <line
              key={i}
              x1="318"
              y1="128.5"
              x2="318"
              y2="131.5"
              strokeWidth="1.3"
              strokeLinecap="round"
              transform={`rotate(${(360 / STAMP_TICKS.length) * i} 318 142)`}
            />
          ))}
          <circle cx="318" cy="142" r="2" fill="var(--primary)" stroke="none" />
        </g>
      </g>

      {/* out — one identical shape per arrival */}
      {!reducedMotion &&
        IN_DELAYS.map((delay) => (
          <g key={delay} opacity="0">
            <Token line={8} stamped />
            <animateMotion
              dur={dur}
              begin={`${delay + OUT_OFFSET}s`}
              repeatCount="indefinite"
              path={OUT_PATH}
              keyPoints="0;1;1"
              keyTimes="0;0.22;1"
              calcMode="spline"
              keySplines="0.22 1 0.36 1;0 0 1 1"
            />
            <animate
              attributeName="opacity"
              dur={dur}
              begin={`${delay + OUT_OFFSET}s`}
              repeatCount="indefinite"
              values="0;1;1;0;0"
              keyTimes="0;0.03;0.19;0.22;1"
            />
          </g>
        ))}

      {/* destination — an inbox, a chat, a webhook: wherever you send it */}
      <g>
        <rect x="550" y="102" width="64" height="48" rx="8" fill="var(--card)" stroke="var(--border)" strokeWidth="1.25" />
        <rect x="567" y="117" width="30" height="20" rx="3" stroke="var(--foreground)" strokeOpacity="0.6" strokeWidth="1.4" />
        <path d="M567 119 L582 130 L597 119" stroke="var(--foreground)" strokeOpacity="0.6" strokeWidth="1.4" strokeLinejoin="round" />
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

/** The warm version of "what is this screen". Used for the Bags list when there are none and
 * as the first thing a fresh bag shows. `action` is the one thing to do next; `aside` is the
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
      <div className="border-b border-border/70 bg-background/60 px-2 pt-4 pb-2 sm:px-6">
        <BagFlowIllustration className="mx-auto max-w-3xl" />
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
