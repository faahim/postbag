import type { DeliveryResult } from "@postbag/core"
import type { ZodType } from "zod"

export type Payload = Readonly<Record<string, unknown>>

export type DeliveryContext = {
  readonly deliveryId: string
  readonly eventType: string
  readonly schemaVersion: number | null
  readonly form: { readonly id: string; readonly slug: string } | null
  readonly stream: { readonly id: string; readonly slug: string } | null
  readonly extras: Payload
  readonly meta: Payload
}

/** ARCHITECTURE.md "Destination adapters" — one file per type implementing this. */
export type DestinationAdapter<Config> = {
  readonly type: string
  readonly configSchema: ZodType<Config>
  redactConfig(config: Config): Partial<Config>
  test(config: Config, sample: Payload): Promise<DeliveryResult>
  deliver(config: Config, payload: Payload, ctx: DeliveryContext): Promise<DeliveryResult>
}

/** Type-erased view used by the registry so it can hold adapters of different configs. */
export type AnyDestinationAdapter = {
  readonly type: string
  readonly configSchema: ZodType
  redactConfig(config: unknown): unknown
  test(config: unknown, sample: Payload): Promise<DeliveryResult>
  deliver(config: unknown, payload: Payload, ctx: DeliveryContext): Promise<DeliveryResult>
}

export function eraseAdapter<Config>(adapter: DestinationAdapter<Config>): AnyDestinationAdapter {
  return {
    type: adapter.type,
    configSchema: adapter.configSchema,
    redactConfig: (config) => adapter.redactConfig(adapter.configSchema.parse(config)),
    test: (config, sample) => adapter.test(adapter.configSchema.parse(config), sample),
    deliver: (config, payload, ctx) => adapter.deliver(adapter.configSchema.parse(config), payload, ctx),
  }
}
