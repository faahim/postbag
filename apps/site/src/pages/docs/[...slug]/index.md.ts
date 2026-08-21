import type { APIRoute } from "astro"
import { getCollection } from "astro:content"
import { SITE_URL } from "@/config"

// Markdown twins of every docs page, for agents (`Accept: text/markdown` is honoured by the server).
export async function getStaticPaths() {
  const docs = await getCollection("docs")
  return docs.map((d) => ({ params: { slug: d.id === "index" ? undefined : d.id }, props: { doc: d } }))
}

export const GET: APIRoute = ({ props }) => {
  const doc = props.doc as { id: string; body?: string; data: { title: string; description: string; modified: string } }
  const path = doc.id === "index" ? "/docs/" : `/docs/${doc.id}/`
  const body = `# ${doc.data.title}\n\n> ${doc.data.description}\n\nSource: ${SITE_URL}${path} · Updated ${doc.data.modified}\n\n${doc.body ?? ""}\n`
  return new Response(body, { headers: { "content-type": "text/markdown; charset=utf-8", "x-robots-tag": "noindex" } })
}
