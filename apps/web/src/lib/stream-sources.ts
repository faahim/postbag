export type StreamSourceRef = {
  readonly form_id?: string
  readonly selector?: string
}

export type StreamSourceForm = {
  readonly id: string
  readonly name: string
  readonly project_id: string
  readonly tags: readonly string[]
}

export function sourceMatchesForm(source: StreamSourceRef, form: StreamSourceForm): boolean {
  if (source.form_id !== undefined) return source.form_id === form.id
  if (source.selector?.startsWith("tag:") === true) return form.tags.includes(source.selector.slice("tag:".length))
  if (source.selector?.startsWith("project:") === true) return form.project_id === source.selector.slice("project:".length)
  return false
}

export function formsForSources(
  sources: readonly StreamSourceRef[],
  forms: readonly StreamSourceForm[],
): readonly StreamSourceForm[] {
  return forms.filter((form) => sources.some((source) => sourceMatchesForm(source, form)))
}

export function selectorDescription(selector: string): string {
  if (selector.startsWith("tag:")) return `Forms tagged “${selector.slice("tag:".length)}”`
  if (selector.startsWith("project:")) return `Forms in project ${selector.slice("project:".length)}`
  return selector
}
