import type { APIRoute } from "astro"
import { GUIDES, type Guide } from "@/content/guides"
import { SITE_URL } from "@/config"

// Markdown twins of every guide, for agents (`Accept: text/markdown` is honoured by the server).
export function getStaticPaths() {
  return GUIDES.map((g) => ({ params: { slug: g.slug }, props: { guide: g } }))
}

function serialize(guide: Guide): string {
  const lines: string[] = [
    `# ${guide.title}`,
    "",
    `> ${guide.description}`,
    "",
    `Source: ${SITE_URL}/guides/${guide.slug}/ · Updated ${guide.modified}`,
    "",
    "## You need",
    "",
    ...guide.needs.map((n) => `- ${n}`),
    ...(guide.versionNote ? [`- ${guide.versionNote}`] : []),
    "",
    `**You leave with:** ${guide.outcome}`,
    "",
    "## For agents",
    "",
    "This whole guide is agent-executable. The one-line version:",
    "",
    "```text",
    guide.agentPrompt,
    "```",
    "",
  ]
  guide.steps.forEach((step, i) => {
    lines.push(`## ${i + 1}. ${step.h}`, "", ...step.p.flatMap((p) => [p, ""]))
    for (const code of [step.code, step.extra]) {
      if (code === undefined) continue
      if (code.title !== undefined) lines.push(`**${code.title}**`, "")
      lines.push(`\`\`\`${code.lang}`, code.code, "```", "")
    }
  })
  if (guide.gotchas.length > 0) {
    lines.push("## The parts that bite", "")
    for (const g of guide.gotchas) lines.push(`- **${g.h}** ${g.p}`)
    lines.push("")
  }
  if (guide.faqs.length > 0) {
    lines.push("## FAQ", "")
    for (const f of guide.faqs) lines.push(`**${f.q}**`, "", f.a, "")
  }
  return lines.join("\n")
}

export const GET: APIRoute = ({ props }) => {
  const guide = props.guide as Guide
  return new Response(serialize(guide), {
    headers: { "content-type": "text/markdown; charset=utf-8", "x-robots-tag": "noindex" },
  })
}
