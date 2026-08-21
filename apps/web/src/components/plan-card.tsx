import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { SuccessCheck } from "@/components/success-check"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { VipBadge } from "@/components/vip-badge"
import { api, toastApiError } from "@/lib/api"
import { formatCount, formatDate } from "@/lib/format"
import { useRedeemPlanCode } from "@/lib/queries/plan"

const PLAN_LABEL: Record<string, string> = { free: "Free", pro: "Pro", team: "Team", selfhost: "Self-hosted" }

function sourceLine(organization: {
  readonly plan_source: string
  readonly plan_note: string | null
  readonly plan_expires_at: string | null
}): string {
  switch (organization.plan_source) {
    case "complimentary": {
      const note = organization.plan_note ?? "Courtesy of Postbag"
      const until = organization.plan_expires_at === null ? "" : ` · until ${formatDate(organization.plan_expires_at)}`
      return `Complimentary · ${note}${until}`
    }
    case "billing":
      return "Billed through Polar"
    case "selfhost":
      return "Self-hosted instance"
    default:
      return "Free"
  }
}

function LimitRow({ label, used, limit }: { readonly label: string; readonly used: number; readonly limit: number }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">
        {formatCount(used)} <span className="text-muted-foreground">/ {formatCount(limit)}</span>
      </span>
    </div>
  )
}

export function PlanCard() {
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.GET("/v1/me")
      return data
    },
  })
  const redeem = useRedeemPlanCode()
  const [redeemOpen, setRedeemOpen] = useState(false)
  const [code, setCode] = useState("")
  const [arrived, setArrived] = useState(false)

  async function submitRedeem() {
    if (code.trim() === "") return
    try {
      await redeem.mutateAsync(code.trim())
      setCode("")
      setRedeemOpen(false)
      setArrived(true)
      toast.success("It arrived — your plan just changed.")
      window.setTimeout(() => {
        setArrived(false)
      }, 2600)
    } catch (error) {
      toastApiError(error, "Couldn't redeem that code — try again.")
    }
  }

  if (me.isLoading || me.data === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  const { organization, limits } = me.data
  const isComplimentary = organization.plan_source === "complimentary"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Plan</CardTitle>
          {isComplimentary && <VipBadge />}
        </div>
        <CardDescription>{sourceLine(organization)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold text-foreground">{PLAN_LABEL[organization.plan] ?? organization.plan}</span>
        </div>

        <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/30 p-3">
          <LimitRow label="Forms" used={limits.used.forms} limit={limits.forms} />
          <LimitRow label="Submissions this month" used={limits.used.submissions_this_month} limit={limits.submissions_per_month} />
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Destinations</span>
            <span className="tabular-nums text-foreground">{formatCount(limits.destinations)}</span>
          </div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Retention</span>
            <span className="tabular-nums text-foreground">{formatCount(limits.retention_days)} days</span>
          </div>
        </div>

        {arrived && (
          <div className="flex animate-in items-center gap-1.5 text-sm text-primary fade-in-0 zoom-in-75 duration-(--duration-very-slow) ease-(--ease-bounce)">
            <SuccessCheck show size={14} />
            It arrived — plan updated.
          </div>
        )}

        {!redeemOpen ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => {
              setRedeemOpen(true)
            }}
          >
            Have a code?
          </Button>
        ) : (
          <div className="flex flex-col gap-2 animate-in fade-in-0 zoom-in-(--dropdown-pre-scale) duration-(--dropdown-open-dur) ease-(--dropdown-ease)">
            <div className="flex gap-2">
              <Input
                autoFocus
                placeholder="Paste your code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitRedeem()
                }}
                className="font-mono text-sm"
              />
              <Button type="button" onClick={() => void submitRedeem()} disabled={redeem.isPending || code.trim() === ""}>
                {redeem.isPending ? "Redeeming…" : "Redeem"}
              </Button>
            </div>
            <button
              type="button"
              className="self-start text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => {
                setRedeemOpen(false)
                setCode("")
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
