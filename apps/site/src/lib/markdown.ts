/**
 * A tiny, purpose-built Markdown-to-HTML renderer for the legal pages (`/legal/*`).
 *
 * Legal copy is authored as plain-string Markdown built from `LEGAL`/`SUBPROCESSORS`
 * (see `@/lib/legal.ts`) so the constants in `config.ts` are the only place the operator
 * name, address and dates live. That string is the single source for both the rendered
 * HTML page and its `.md` twin — rendering it here (rather than reaching for a content
 * collection, which cannot interpolate JS values) keeps the two representations identical
 * by construction. Supports exactly what the legal copy needs: `##`/`###` headings,
 * paragraphs, `**bold**`, `[text](url)` links, `- ` bullet lists and `| … |` tables.
 */

export interface MarkdownHeading {
  depth: 2 | 3
  slug: string
  text: string
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
}

function escapeHtml(text: string): string {
  return text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")
}

function renderInline(text: string): string {
  const escaped = escapeHtml(text)
  const withLinks = escaped.replace(
    /\[([^\]]+)\]\(([^)]+)\)/gu,
    (_m, label: string, href: string) => `<a href="${href}">${label}</a>`,
  )
  return withLinks.replace(/\*\*([^*]+)\*\*/gu, "<strong>$1</strong>")
}

/** Renders a Markdown string to HTML and returns the h2/h3 headings found, for a table of contents. */
export function renderMarkdown(markdown: string): { html: string; headings: MarkdownHeading[] } {
  const lines = markdown.trim().split("\n")
  const headings: MarkdownHeading[] = []
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = (lines[i] ?? "").trim()
    if (line === "") {
      i++
      continue
    }
    if (line.startsWith("### ")) {
      const text = line.slice(4)
      const slug = slugify(text)
      headings.push({ depth: 3, slug, text })
      out.push(`<h3 id="${slug}">${renderInline(text)}</h3>`)
      i++
      continue
    }
    if (line.startsWith("## ")) {
      const text = line.slice(3)
      const slug = slugify(text)
      headings.push({ depth: 2, slug, text })
      out.push(`<h2 id="${slug}">${renderInline(text)}</h2>`)
      i++
      continue
    }
    if (line.startsWith("|")) {
      const rows: string[] = []
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("|")) {
        rows.push((lines[i] ?? "").trim())
        i++
      }
      const cells = rows.map((r) =>
        r
          .slice(1, r.endsWith("|") ? -1 : undefined)
          .split("|")
          .map((c) => c.trim()),
      )
      const [head, sep, ...body] = cells
      const isSeparator = sep?.every((c) => /^-+$/u.test(c)) ?? false
      if (head && isSeparator) {
        const thead = `<tr>${head.map((c) => `<th>${renderInline(c)}</th>`).join("")}</tr>`
        const tbody = body.map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`).join("")
        out.push(`<div class="table-wrap"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`)
      }
      continue
    }
    if (line.startsWith("- ")) {
      const items: string[] = []
      while (i < lines.length && (lines[i] ?? "").trim().startsWith("- ")) {
        items.push((lines[i] ?? "").trim().slice(2))
        i++
      }
      out.push(`<ul>${items.map((it) => `<li>${renderInline(it)}</li>`).join("")}</ul>`)
      continue
    }
    const para: string[] = [line]
    i++
    while (i < lines.length && (lines[i] ?? "").trim() !== "") {
      para.push((lines[i] ?? "").trim())
      i++
    }
    out.push(`<p>${renderInline(para.join(" "))}</p>`)
  }
  return { html: out.join("\n"), headings }
}
