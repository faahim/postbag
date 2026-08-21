import type { APIRoute } from "astro"
import { getCollection } from "astro:content"
import { API_URL, DESCRIPTION, SITE_URL } from "@/config"
import { FEATURES } from "@/content/features"
import { LEGAL_DOCS } from "@/lib/legal"

// llmstxt.org: llms-full.txt = the whole documentation set in one Markdown file.
export const GET: APIRoute = async () => {
  const docs = (await getCollection("docs")).sort((a, b) => a.data.order - b.data.order)
  const head = `# Postbag\n\n> ${DESCRIPTION}\n\nAPI base: ${API_URL} · Agent onboarding: ${API_URL}/llms.txt · OpenAPI: ${API_URL}/openapi.json · Site: ${SITE_URL}\n\n## Pages\n\n${FEATURES.map((f) => `- [${f.title}](${SITE_URL}/features/${f.slug}/): ${f.description}`).join("\n")}\n- [For AI agents](${SITE_URL}/for-ai-agents/): how an agent with only an API key creates, verifies and routes a form.\n- [Pricing](${SITE_URL}/pricing/): plan limits.\n- [Compare](${SITE_URL}/compare/): Postbag vs Formspree, Formspark, Getform (Forminit), Basin, Web3Forms, Netlify Forms.\n- [Glossary](${SITE_URL}/glossary/): the fixed vocabulary.\n${LEGAL_DOCS.map((d) => `- [${d.title}](${SITE_URL}/legal/${d.slug}/): ${d.description}`).join("\n")}\n\n---\n\n`
  const body = docs.map((d) => `# ${d.data.title}\n\n> ${d.data.description}\n\nSource: ${SITE_URL}${d.id === "index" ? "/docs/" : `/docs/${d.id}/`}\n\n${d.body ?? ""}`).join("\n\n---\n\n")
  const legal = LEGAL_DOCS.map((d) => `# ${d.title}\n\n> ${d.description}\n\nSource: ${SITE_URL}/legal/${d.slug}/\n\n${d.markdown.trim()}`).join("\n\n---\n\n")
  return new Response(head + body + "\n\n---\n\n" + legal + "\n", { headers: { "content-type": "text/markdown; charset=utf-8", "x-robots-tag": "noindex" } })
}
