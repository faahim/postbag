import { API_URL, AUTHOR, DESCRIPTION, GITHUB_URL, SITE_NAME, SITE_URL, TAGLINE } from "@/config"

export const ORG_ID = `${SITE_URL}/#organization`
export const SITE_ID = `${SITE_URL}/#website`
export const APP_ID = `${SITE_URL}/#software`

export function organizationLd() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png`, width: 512, height: 512 },
    description: TAGLINE,
    founder: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
    sameAs: [GITHUB_URL],
  }
}

export function websiteLd() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    description: DESCRIPTION,
    publisher: { "@id": ORG_ID },
    inLanguage: "en",
  }
}

export function softwareLd() {
  return {
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: SITE_NAME,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "Form backend",
    operatingSystem: "Web, Docker (self-hosted)",
    url: `${SITE_URL}/`,
    description: DESCRIPTION,
    softwareHelp: { "@type": "CreativeWork", url: `${SITE_URL}/docs/` },
    downloadUrl: GITHUB_URL,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free plan: 5 forms, 1,000 submissions per month, 5 destinations, 90-day retention." },
    featureList: [
      "HTML form endpoint accepting JSON, urlencoded and multipart",
      "Every submission stored with a status before delivery; nothing is dropped",
      "Email, Telegram and HMAC-signed webhook destinations",
      "Routes with digest mode, delivery windows and quality rules",
      "Streams: many forms mapped onto one versioned output schema",
      "Schema versions, drift detection and inference",
      "Honeypot, origin allowlist, per-form rate limit, Cloudflare Turnstile",
      "OpenAPI contract, llms.txt, one-call quickstart for AI agents",
      "Self-hostable: one Docker image and one Postgres",
    ],
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isAccessibleForFree: true,
    sameAs: [GITHUB_URL, `${API_URL}/openapi.json`],
  }
}

export type Crumb = { name: string; href: string }
export function breadcrumbLd(crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.href.startsWith("http") ? c.href : `${SITE_URL}${c.href}`,
    })),
  }
}

export type Faq = { q: string; a: string }
export function faqLd(faqs: Faq[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  }
}

export function articleLd(input: { title: string; description: string; url: string; published: string; modified: string; type?: "TechArticle" | "Article" }) {
  return {
    "@type": input.type ?? "TechArticle",
    headline: input.title,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    datePublished: input.published,
    dateModified: input.modified,
    author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
    publisher: { "@id": ORG_ID },
    inLanguage: "en",
    isPartOf: { "@id": SITE_ID },
    about: { "@id": APP_ID },
  }
}

export function webPageLd(input: { url: string; name: string; description: string; modified?: string }) {
  return {
    "@type": "WebPage",
    "@id": `${input.url}#webpage`,
    url: input.url,
    name: input.name,
    description: input.description,
    isPartOf: { "@id": SITE_ID },
    about: { "@id": APP_ID },
    ...(input.modified ? { dateModified: input.modified } : {}),
    inLanguage: "en",
  }
}
