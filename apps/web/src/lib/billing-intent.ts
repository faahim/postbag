import { z } from "zod"

export const billingIntentSearchSchema = z.object({
  plan: z.enum(["pro", "team"]).optional(),
  interval: z.enum(["month", "year"]).optional(),
  checkout: z
    .union([z.literal("1"), z.literal(1)])
    .transform(() => 1 as const)
    .optional(),
})

export type BillingIntentSearch = z.infer<typeof billingIntentSearchSchema>

export type BillingIntent = {
  readonly plan: "pro" | "team"
  readonly interval: "month" | "year"
}

export function billingIntentFromSearch(search: BillingIntentSearch): BillingIntent | null {
  if (search.checkout !== 1 || search.plan === undefined || search.interval === undefined) {
    return null
  }
  return { plan: search.plan, interval: search.interval }
}
