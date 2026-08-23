import { readFile, mkdir } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

const root = path.resolve(import.meta.dirname, "../../..")
const source = path.join(root, "assets/brand/final-source/social-routing-field-v1.png")
const logo = path.join(root, "apps/site/public/logo-mark-455264e.svg")
const output = path.join(root, "apps/site/public/og")

const cards = {
  default: {
    title: ["Your forms have", "somewhere to go."],
    body: "The open-source form backend built for agents.",
  },
  agents: {
    title: ["Your agent can finish", "the Form first."],
    body: "Create it, wire it, test it, then claim it when you are ready.",
  },
  features: {
    title: ["Save first.", "Route with a record."],
    body: "Forms, Destinations, Routes, Schemas, and every Delivery attempt.",
  },
  compare: {
    title: ["A form backend", "you can actually own."],
    body: "Clear, sourced comparisons with cloud and self-hosting in view.",
  },
  docs: {
    title: ["The contract,", "in plain sight."],
    body: "Quickstart, API, self-hosting, and agent guidance.",
  },
}

const escapeXml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

function copyLayer({ title, body }) {
  const lines = title
    .map((line, index) => `<tspan x="78" dy="${index === 0 ? 0 : 72}">${escapeXml(line)}</tspan>`)
    .join("")
  return Buffer.from(`
    <svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scrim" x1="0" x2="1">
          <stop offset="0" stop-color="#080b24" stop-opacity="0.98"/>
          <stop offset="0.52" stop-color="#080b24" stop-opacity="0.86"/>
          <stop offset="0.78" stop-color="#080b24" stop-opacity="0.08"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#scrim)"/>
      <text x="78" y="230" fill="#f5f5ff" font-family="Arial, Helvetica, sans-serif"
        font-size="65" font-weight="700" letter-spacing="-2.2">${lines}</text>
      <text x="80" y="414" fill="#c8cae4" font-family="Arial, Helvetica, sans-serif"
        font-size="24" font-weight="400">${escapeXml(body)}</text>
      <text x="80" y="552" fill="#aeb3f6" font-family="Arial, Helvetica, sans-serif"
        font-size="19" font-weight="600" letter-spacing="1.2">POSTBAG.DEV</text>
    </svg>
  `)
}

await mkdir(output, { recursive: true })
const logoBuffer = await readFile(logo)

for (const [name, card] of Object.entries(cards)) {
  const background = await sharp(source)
    .resize(1200, 630, { fit: "cover", position: "centre" })
    .png()
    .toBuffer()
  const logoSized = await sharp(logoBuffer).resize(43, 43).png().toBuffer()
  await sharp(background)
    .composite([
      { input: copyLayer(card), top: 0, left: 0 },
      { input: logoSized, top: 66, left: 78 },
      {
        input: Buffer.from(`
          <svg width="180" height="48" xmlns="http://www.w3.org/2000/svg">
            <text x="54" y="33" fill="#f5f5ff" font-family="Arial, Helvetica, sans-serif"
              font-size="27" font-weight="700" letter-spacing="-0.7">Postbag</text>
          </svg>
        `),
        top: 63,
        left: 78,
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(output, `${name}.png`))
}

console.log(`Generated ${Object.keys(cards).length} social images in ${output}`)
