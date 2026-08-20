import type { UiHints } from "@postbag/core"

export type EmbedFields = readonly { readonly name: string; readonly label: string; readonly widget: string }[]

const DEFAULT_FIELDS: EmbedFields = [
  { name: "email", label: "Email", widget: "email" },
  { name: "message", label: "Message", widget: "textarea" },
]

export function fieldsFromUiHints(ui: UiHints | undefined): EmbedFields {
  if (ui === undefined || Object.keys(ui).length === 0) return DEFAULT_FIELDS
  return Object.entries(ui)
    .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
    .map(([name, hint]) => ({
      name,
      label: hint.label ?? name,
      widget: hint.widget ?? "text",
    }))
}

function htmlInput(field: EmbedFields[number]): string {
  if (field.widget === "textarea") {
    return `  <label>${field.label}<textarea name="${field.name}" required></textarea></label>`
  }
  const type = field.widget === "checkbox" || field.widget === "select" ? "text" : field.widget
  return `  <label>${field.label}<input type="${type}" name="${field.name}" required /></label>`
}

export function htmlSnippet(submitUrl: string, fields: EmbedFields): string {
  const inputs = fields.map(htmlInput).join("\n")
  return `<form action="${submitUrl}" method="POST">\n${inputs}\n  <button type="submit">Send</button>\n</form>`
}

export function fetchSnippet(submitUrl: string): string {
  return `await fetch("${submitUrl}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(data),\n})`
}

export function reactSnippet(submitUrl: string, fields: EmbedFields): string {
  const inputs = fields
    .map((field) =>
      field.widget === "textarea"
        ? `      <textarea name="${field.name}" placeholder="${field.label}" required />`
        : `      <input type="${field.widget === "checkbox" ? "text" : field.widget}" name="${field.name}" placeholder="${field.label}" required />`,
    )
    .join("\n")
  return [
    "async function handleSubmit(event) {",
    "  event.preventDefault()",
    `  await fetch("${submitUrl}", { method: "POST", body: new FormData(event.currentTarget) })`,
    "}",
    "",
    "export function ContactForm() {",
    "  return (",
    "    <form onSubmit={handleSubmit}>",
    inputs,
    '      <button type="submit">Send</button>',
    "    </form>",
    "  )",
    "}",
  ].join("\n")
}

export function astroSnippet(submitUrl: string, fields: EmbedFields): string {
  const inputs = fields
    .map((field) =>
      field.widget === "textarea"
        ? `  <textarea name="${field.name}" placeholder="${field.label}" required></textarea>`
        : `  <input type="${field.widget === "checkbox" ? "text" : field.widget}" name="${field.name}" placeholder="${field.label}" required />`,
    )
    .join("\n")
  return `<form action="${submitUrl}" method="POST">\n${inputs}\n  <button type="submit">Send</button>\n</form>`
}

export function nextjsActionSnippet(submitUrl: string): string {
  return [
    '"use server"',
    "",
    "export async function submitForm(formData: FormData) {",
    `  await fetch("${submitUrl}", { method: "POST", body: formData })`,
    "}",
  ].join("\n")
}

export type Embed = {
  readonly html: string
  readonly fetch: string
  readonly react: string
  readonly astro: string
  readonly nextjs_action: string
}

export function renderEmbed(submitUrl: string, ui: UiHints | undefined): Embed {
  const fields = fieldsFromUiHints(ui)
  return {
    html: htmlSnippet(submitUrl, fields),
    fetch: fetchSnippet(submitUrl),
    react: reactSnippet(submitUrl, fields),
    astro: astroSnippet(submitUrl, fields),
    nextjs_action: nextjsActionSnippet(submitUrl),
  }
}
