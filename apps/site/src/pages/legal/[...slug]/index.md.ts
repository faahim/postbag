import type { APIRoute } from "astro"
import { SITE_URL, LEGAL } from "@/config"
import { LEGAL_DOCS } from "@/lib/legal"

// Markdown twins of the legal pages, for agents (`Accept: text/markdown` is honoured by the server).
export function getStaticPaths() {
  return LEGAL_DOCS.map((doc) => ({ params: { slug: doc.slug }, props: { doc } }))
}

export const GET: APIRoute = ({ props }) => {
  const doc = props.doc as (typeof LEGAL_DOCS)[number]
  const path = `/legal/${doc.slug}/`
  const body = `# ${doc.title}\n\n> ${doc.description}\n\nSource: ${SITE_URL}${path} · Last updated: ${LEGAL.effectiveDate}\n\n${doc.markdown.trim()}\n`
  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "x-robots-tag": "noindex" } })
}
