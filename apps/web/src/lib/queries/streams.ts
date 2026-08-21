import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { z } from "zod"
import type { StreamInputSchema, StreamSourceInputSchema } from "@postbag/core"
import type { components } from "@postbag/sdk"

import { api, unwrap, type Paginated } from "@/lib/api"

export type Stream = components["schemas"]["Stream"]
export type StreamDetail = components["schemas"]["StreamDetail"]
export type SchemaVersion = components["schemas"]["SchemaVersion"]
export type StreamInput = z.input<typeof StreamInputSchema>
export type StreamSourceInput = z.input<typeof StreamSourceInputSchema>

export function useStreams() {
  return useQuery<readonly Stream[]>({
    queryKey: ["streams"],
    queryFn: async (): Promise<readonly Stream[]> => {
      const page: Paginated<Stream> = unwrap(await api.GET("/v1/streams", { params: { query: { limit: 100 } } }))
      return page.data
    },
  })
}

export function useStream(streamId: string | undefined) {
  return useQuery<StreamDetail>({
    queryKey: ["streams", streamId],
    queryFn: async (): Promise<StreamDetail> =>
      unwrap(await api.GET("/v1/streams/{streamId}", { params: { path: { streamId: streamId ?? "" } } })),
    enabled: streamId !== undefined,
  })
}

export function useStreamSchema(streamId: string | undefined) {
  return useQuery<SchemaVersion | null>({
    queryKey: ["streams", streamId, "schema"],
    queryFn: async (): Promise<SchemaVersion | null> => {
      const result = await api.GET("/v1/streams/{streamId}/schema", { params: { path: { streamId: streamId ?? "" } } })
      if (result.response.status === 404) return null
      return unwrap(result)
    },
    enabled: streamId !== undefined,
  })
}

export function useCreateStream() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: StreamInput): Promise<Stream> =>
      unwrap(await api.POST("/v1/streams", { body: body as unknown as never })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["streams"] })
      await queryClient.invalidateQueries({ queryKey: ["me"] })
    },
  })
}

export function usePublishStreamSchema(streamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { readonly json_schema: unknown; readonly ui?: unknown; readonly changelog?: string }) =>
      unwrap(
        await api.POST("/v1/streams/{streamId}/schema", {
          params: { path: { streamId } },
          body: body as unknown as never,
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["streams", streamId] })
    },
  })
}

export function useAddStreamSource(streamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: StreamSourceInput): Promise<components["schemas"]["StreamSource"]> =>
      unwrap(
        await api.POST("/v1/streams/{streamId}/sources", {
          params: { path: { streamId } },
          body: body as unknown as never,
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["streams", streamId] })
    },
  })
}

export function useUpdateStreamSource(streamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sourceId, body }: { readonly sourceId: string; readonly body: Record<string, unknown> }) =>
      unwrap(
        await api.PATCH("/v1/streams/{streamId}/sources/{sourceId}", {
          params: { path: { streamId, sourceId } },
          body,
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["streams", streamId] })
    },
  })
}

export function useRemoveStreamSource(streamId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sourceId: string): Promise<void> => {
      const result = await api.DELETE("/v1/streams/{streamId}/sources/{sourceId}", { params: { path: { streamId, sourceId } } })
      if (result.error !== undefined) unwrap(result)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["streams", streamId] })
    },
  })
}

export type StreamPreviewResult = { readonly payload: Record<string, unknown>; readonly extras: Record<string, unknown>; readonly problems: readonly string[] }

export function useStreamPreview(streamId: string) {
  return useMutation({
    mutationFn: async (input: { readonly formId: string; readonly data: Record<string, unknown> }): Promise<StreamPreviewResult> =>
      unwrap(
        await api.POST("/v1/streams/{streamId}/preview", {
          params: { path: { streamId } },
          body: { form_id: input.formId, data: input.data },
        }),
      ),
  })
}
