import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { components } from "@postbag/sdk"

import { api, unwrap, type Paginated } from "@/lib/api"

export type Submission = components["schemas"]["Submission"]
export type SubmissionDetail = components["schemas"]["SubmissionDetail"]
export type SubmissionStatus = "received" | "quarantined" | "spam"

export type SubmissionListParams = {
  readonly form?: string | undefined
  readonly stream?: string | undefined
  readonly status?: string | undefined
  readonly q?: string | undefined
}

export function useSubmissions(params: SubmissionListParams = {}) {
  return useQuery<Paginated<Submission>>({
    queryKey: ["submissions", params],
    queryFn: async (): Promise<Paginated<Submission>> =>
      unwrap(
        await api.GET("/v1/submissions", { params: { query: { ...params, limit: 50 } as unknown as never } }),
      ),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  })
}

export function useFormSubmissions(formId: string | undefined, opts: { readonly poll?: boolean } = {}) {
  return useQuery<Paginated<Submission>>({
    queryKey: ["forms", formId, "submissions"],
    queryFn: async (): Promise<Paginated<Submission>> =>
      unwrap(
        await api.GET("/v1/forms/{formId}/submissions", {
          params: { path: { formId: formId ?? "" }, query: { limit: 50 } },
        }),
      ),
    enabled: formId !== undefined,
    refetchInterval: opts.poll === true ? 3000 : 5000,
    refetchIntervalInBackground: true,
  })
}

export function useSubmission(submissionId: string | undefined) {
  return useQuery<SubmissionDetail>({
    queryKey: ["submissions", submissionId],
    queryFn: async (): Promise<SubmissionDetail> =>
      unwrap(await api.GET("/v1/submissions/{submissionId}", { params: { path: { submissionId: submissionId ?? "" } } })),
    enabled: submissionId !== undefined,
  })
}

export function useUpdateSubmissionStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ submissionId, status }: { readonly submissionId: string; readonly status: SubmissionStatus }): Promise<Submission> =>
      unwrap(await api.PATCH("/v1/submissions/{submissionId}", { params: { path: { submissionId } }, body: { status } })),
    onMutate: async ({ submissionId, status }) => {
      // Two cache shapes hold submission rows: the org-wide list (["submissions", params]) and
      // each form's inbox (["forms", formId, "submissions"]). The single-submission detail cache
      // (["submissions", id]) shares the "submissions" key prefix but holds a SubmissionDetail
      // object, not a paginated list — `Array.isArray` below is what keeps this from touching it.
      const isSubmissionList = (queryKey: readonly unknown[]): boolean =>
        queryKey[0] === "submissions" || (queryKey[0] === "forms" && queryKey[2] === "submissions")

      await queryClient.cancelQueries({ predicate: (query) => isSubmissionList(query.queryKey) })
      const previous = queryClient
        .getQueriesData({ predicate: (query) => isSubmissionList(query.queryKey) })
        .filter((entry): entry is [readonly unknown[], Paginated<Submission>] => Array.isArray((entry[1] as Paginated<Submission> | undefined)?.data))

      for (const [key, data] of previous) {
        queryClient.setQueryData<Paginated<Submission>>(key, {
          ...data,
          data: data.data.map((s) => (s.id === submissionId ? { ...s, status } : s)),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "submissions" || (query.queryKey[0] === "forms" && query.queryKey[2] === "submissions") })
    },
  })
}
