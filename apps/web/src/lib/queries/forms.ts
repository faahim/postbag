import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { FormInput, QuickstartInput } from "@postbag/core"
import type { components } from "@postbag/sdk"

import { api, unwrap, type Paginated } from "@/lib/api"

export type Form = components["schemas"]["Form"]
export type FormCreated = components["schemas"]["FormCreated"]
export type Embed = components["schemas"]["Embed"]
export type SchemaVersion = components["schemas"]["SchemaVersion"]

/** The `/v1/forms/{formId}/drift` response is `{}[]` in the generated schema (the Zod
 * shape for this route isn't a registered OpenAPI component) — this mirrors the actual
 * runtime shape from `apps/server/src/routes/v1/forms.ts`. */
export type DriftEvent = {
  readonly id: string
  readonly form_id: string
  readonly submission_id: string | null
  readonly kind: string
  readonly field: string
  readonly details: unknown
  readonly detected_at: string
  readonly resolved_at: string | null
}

export function useForms(params: { readonly project?: string; readonly tag?: string } = {}) {
  return useQuery<Paginated<Form>>({
    queryKey: ["forms", params],
    queryFn: async (): Promise<Paginated<Form>> =>
      unwrap(await api.GET("/v1/forms", { params: { query: { ...params, limit: 100 } } })),
  })
}

export function useForm(formId: string | undefined) {
  return useQuery<Form>({
    queryKey: ["forms", formId],
    queryFn: async (): Promise<Form> =>
      unwrap(await api.GET("/v1/forms/{formId}", { params: { path: { formId: formId ?? "" } } })),
    enabled: formId !== undefined,
  })
}

export function useFormSchema(formId: string | undefined) {
  return useQuery<SchemaVersion | null>({
    queryKey: ["forms", formId, "schema"],
    queryFn: async (): Promise<SchemaVersion | null> => {
      const result = await api.GET("/v1/forms/{formId}/schema", { params: { path: { formId: formId ?? "" } } })
      if (result.response.status === 404) return null
      return unwrap(result)
    },
    enabled: formId !== undefined,
  })
}

export function useFormDrift(formId: string | undefined) {
  return useQuery<DriftEvent[]>({
    queryKey: ["forms", formId, "drift"],
    queryFn: async (): Promise<DriftEvent[]> =>
      unwrap(await api.GET("/v1/forms/{formId}/drift", { params: { path: { formId: formId ?? "" } } })) as DriftEvent[],
    enabled: formId !== undefined,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  })
}

export function useFormEmbed(formId: string | undefined) {
  return useQuery<Embed>({
    queryKey: ["forms", formId, "embed"],
    queryFn: async (): Promise<Embed> =>
      unwrap(await api.GET("/v1/forms/{formId}/embed", { params: { path: { formId: formId ?? "" } } })),
    enabled: formId !== undefined,
  })
}

export function useCreateForm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: FormInput): Promise<Form> =>
      unwrap(await api.POST("/v1/forms", { body: body as unknown as never })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forms"] })
      await queryClient.invalidateQueries({ queryKey: ["me"] })
    },
  })
}

export function useQuickstart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: QuickstartInput) =>
      unwrap(await api.POST("/v1/quickstart", { body: body as unknown as never })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forms"] })
      await queryClient.invalidateQueries({ queryKey: ["me"] })
    },
  })
}

export function usePublishFormSchema(formId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { readonly json_schema: unknown; readonly ui?: unknown; readonly changelog?: string }) =>
      unwrap(
        await api.POST("/v1/forms/{formId}/schema", {
          params: { path: { formId } },
          body: body as unknown as never,
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forms", formId] })
      await queryClient.invalidateQueries({ queryKey: ["forms", formId, "drift"] })
    },
  })
}

export function useUpdateForm(formId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>): Promise<Form> =>
      unwrap(await api.PATCH("/v1/forms/{formId}", { params: { path: { formId } }, body })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["forms"] })
    },
  })
}
