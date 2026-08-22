import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toastApiError } from "@/lib/api"
import {
  useBilling,
  useBillingCheckout,
  useBillingPortal,
  type BillingCheckoutInput,
} from "@/lib/queries/billing"

type CheckoutPlan = BillingCheckoutInput["plan"]
type CheckoutInterval = BillingCheckoutInput["interval"]

const CHECKOUT_PLANS: readonly CheckoutPlan[] = ["pro", "team"]
const PLAN_LABEL: Record<CheckoutPlan, string> = { pro: "Pro", team: "Team" }
const PRICE: Record<
  CheckoutPlan,
  Record<CheckoutInterval, { readonly monthly: string; readonly detail: string }>
> = {
  pro: {
    month: { monthly: "$15 / month", detail: "Billed monthly" },
    year: { monthly: "$12 / month", detail: "$144 billed yearly" },
  },
  team: {
    month: { monthly: "$49 / month", detail: "Billed monthly" },
    year: { monthly: "$39 / month", detail: "$468 billed yearly" },
  },
}

export function PlanBillingControls({ planSource }: { readonly planSource: string }) {
  const billing = useBilling()
  const checkout = useBillingCheckout()
  const portal = useBillingPortal()
  const [interval, setInterval] = useState<CheckoutInterval>("month")
  const billingData = billing.data
  const availablePlans: readonly CheckoutPlan[] =
    billingData === undefined
      ? []
      : CHECKOUT_PLANS.filter((plan) => billingData.products[plan][interval])

  async function startCheckout(plan: CheckoutPlan) {
    try {
      const { url } = await checkout.mutateAsync({ plan, interval })
      window.location.assign(url)
    } catch (error) {
      toastApiError(error, "Couldn't start checkout — try again.")
    }
  }

  async function openPortal() {
    try {
      const { url } = await portal.mutateAsync()
      window.location.assign(url)
    } catch (error) {
      toastApiError(error, "Couldn't open billing management — try again.")
    }
  }

  if (planSource === "complimentary" || planSource === "selfhost") return null

  if (planSource === "billing") {
    return (
      <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">Billing</p>
          <p className="text-pretty text-sm text-muted-foreground">
            {billingData?.subscription?.cancel_at_period_end
              ? "Your subscription is set to end at the current billing period."
              : "Manage your subscription, invoices and payment method through Polar."}
          </p>
        </div>
        {billing.isLoading ? (
          <Skeleton className="h-10 w-36" />
        ) : billingData?.enabled ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-10 self-start"
            disabled={portal.isPending}
            onClick={() => void openPortal()}
          >
            {portal.isPending ? "Opening billing…" : "Manage billing"}
          </Button>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Billing management is temporarily unavailable on this instance.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">Upgrade your workspace</p>
        <p className="text-pretty text-sm text-muted-foreground">
          Choose monthly or annual billing. You will complete payment with Polar.
        </p>
      </div>
      {billing.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : billing.isError || billingData === undefined ? (
        <p role="alert" className="text-sm text-destructive">
          Billing options could not be loaded. Refresh and try again.
        </p>
      ) : !billingData.enabled ? (
        <p role="status" className="text-sm text-muted-foreground">
          Billing is not enabled on this Postbag instance.
        </p>
      ) : (
        <>
          <Tabs
            value={interval}
            onValueChange={(value) => {
              switch (value) {
                case "month":
                case "year":
                  setInterval(value)
              }
            }}
          >
            <TabsList aria-label="Billing interval" className="h-auto min-h-10 w-full sm:w-fit">
              <TabsTrigger value="month" className="min-h-10">
                Monthly
              </TabsTrigger>
              <TabsTrigger value="year" className="min-h-10">
                Yearly
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {availablePlans.length === 0 ? (
            <p role="status" className="text-sm text-muted-foreground">
              No {interval === "month" ? "monthly" : "yearly"} plans are configured yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {availablePlans.map((plan) => (
                <div
                  key={plan}
                  className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-foreground">{PLAN_LABEL[plan]}</p>
                    <p className="tabular-nums text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {PRICE[plan][interval].monthly}
                      </span>{" "}
                      · {PRICE[plan][interval].detail}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="min-h-10 self-start sm:self-auto"
                    disabled={checkout.isPending}
                    onClick={() => void startCheckout(plan)}
                  >
                    {checkout.isPending && checkout.variables.plan === plan
                      ? "Opening checkout…"
                      : `Choose ${PLAN_LABEL[plan]}`}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
