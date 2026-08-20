import { TemplateSyntaxError } from "./errors.js"

type Token =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "tag"; readonly value: string; readonly raw: boolean }
type Node =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "variable"; readonly path: string; readonly raw: boolean }
  | { readonly kind: "if"; readonly path: string; readonly children: readonly Node[] }
  | { readonly kind: "each"; readonly path: string; readonly children: readonly Node[] }
type ParseResult = { readonly nodes: readonly Node[]; readonly next: number }

function tokensFor(template: string): readonly Token[] {
  const tokens: Token[] = []
  const pattern = /\{\{\{([\s\S]*?)\}\}\}|\{\{([\s\S]*?)\}\}/gu
  let cursor = 0
  for (const match of template.matchAll(pattern)) {
    const index = match.index
    if (index > cursor) tokens.push({ kind: "text", value: template.slice(cursor, index) })
    const triple = match[1]
    const normal = match[2]
    tokens.push({ kind: "tag", value: (triple ?? normal ?? "").trim(), raw: triple !== undefined })
    cursor = index + match[0].length
  }
  if (cursor < template.length) tokens.push({ kind: "text", value: template.slice(cursor) })
  return tokens
}

function parse(tokens: readonly Token[], start: number, closing?: "if" | "each"): ParseResult {
  const nodes: Node[] = []
  let index = start
  while (index < tokens.length) {
    const token = tokens[index]
    if (token === undefined) break
    if (token.kind === "text") {
      nodes.push(token)
      index += 1
      continue
    }
    if (token.value.startsWith("/")) {
      const close = token.value.slice(1).trim()
      if (closing === undefined || close !== closing) {
        throw new TemplateSyntaxError(`Unexpected closing template tag '${token.value}'.`)
      }
      return { nodes, next: index + 1 }
    }
    if (token.value.startsWith("#if ")) {
      const path = token.value.slice(4).trim()
      const children = parse(tokens, index + 1, "if")
      nodes.push({ kind: "if", path, children: children.nodes })
      index = children.next
      continue
    }
    if (token.value.startsWith("#each ")) {
      const path = token.value.slice(6).trim()
      const children = parse(tokens, index + 1, "each")
      nodes.push({ kind: "each", path, children: children.nodes })
      index = children.next
      continue
    }
    if (token.value.startsWith("#")) {
      throw new TemplateSyntaxError(`Unknown template block '${token.value}'.`)
    }
    nodes.push({ kind: "variable", path: token.value, raw: token.raw })
    index += 1
  }
  if (closing !== undefined) throw new TemplateSyntaxError(`Missing closing tag for '${closing}'.`)
  return { nodes, next: index }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function fromValue(value: unknown, path: readonly string[]): unknown {
  let current = value
  for (const segment of path) {
    if (!isRecord(current)) return undefined
    current = current[segment]
  }
  return current
}

function resolve(path: string, contexts: readonly unknown[]): unknown {
  if (path === "this" || path === ".") return contexts.at(-1)
  const segments = path.split(".")
  for (let index = contexts.length - 1; index >= 0; index -= 1) {
    const value = fromValue(contexts[index], segments)
    if (value !== undefined) return value
  }
  return undefined
}

function valueText(value: unknown): string {
  if (value === undefined || value === null || value === false) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value)
  }
  return JSON.stringify(value)
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

function renderNodes(nodes: readonly Node[], contexts: readonly unknown[]): string {
  let result = ""
  for (const node of nodes) {
    switch (node.kind) {
      case "text":
        result += node.value
        break
      case "variable": {
        const text = valueText(resolve(node.path, contexts))
        result += node.raw ? text : escapeHtml(text)
        break
      }
      case "if": {
        if (truthy(resolve(node.path, contexts))) result += renderNodes(node.children, contexts)
        break
      }
      case "each": {
        const items = resolve(node.path, contexts)
        if (Array.isArray(items)) {
          for (const item of items) result += renderNodes(node.children, [...contexts, item])
        }
        break
      }
    }
  }
  return result
}

export function renderTemplate(template: string, data: Readonly<Record<string, unknown>>): string {
  return renderNodes(parse(tokensFor(template), 0).nodes, [data])
}
