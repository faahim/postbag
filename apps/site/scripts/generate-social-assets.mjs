import { constants } from "node:fs"
import { access, mkdtemp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { chromium } from "playwright-core"
import sharp from "sharp"

const CARD_WIDTH = 1200
const CARD_HEIGHT = 630
const MAX_BYTES = 450 * 1024

const root = path.resolve(import.meta.dirname, "../../..")
const site = path.join(root, "apps/site")
const output = path.join(site, "public/og")

const assets = {
  background: path.join(root, "assets/brand/final-source/social-routing-field-v1.png"),
  grain: path.join(site, "public/brand/interface-grain-v1.webp"),
  logo: path.join(site, "public/logo-mark-455264e.svg"),
  bricolage: path.join(
    site,
    "node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2",
  ),
  instrument: path.join(
    site,
    "node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-standard-normal.woff2",
  ),
  jetbrains: path.join(
    site,
    "node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  ),
}

const cards = {
  default: {
    kicker: "Open source · Agent-native · Yours",
    title: ["Your forms have", "somewhere to go."],
    body: "The open-source form backend built for agents.",
  },
  agents: {
    kicker: "For AI agents",
    title: ["Your agent can finish", "before you sign up."],
    body: "It builds, wires and tests the form. You claim it.",
  },
  features: {
    kicker: "Saved first, sent second",
    title: ["Nothing that arrives", "ever gets lost."],
    body: "Every message on the record, every attempt visible.",
  },
  compare: {
    kicker: "Comparisons",
    title: ["A form backend", "you can actually own."],
    body: "Same evidence, the vendor's own sources, a date on every fact.",
  },
  docs: {
    kicker: "The docs",
    title: ["The contract,", "in plain sight."],
    body: "Quickstart, API, self-hosting, agent guidance.",
  },
}

function fileUrl(file) {
  return pathToFileURL(file).href
}

async function newestChromiumExecutable() {
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright")
  let entries

  try {
    entries = await readdir(cache, { withFileTypes: true })
  } catch (error) {
    throw new Error(
      `Cannot read the Playwright browser cache at ${cache}. Install a Chromium headless shell before running brand:social.`,
      { cause: error },
    )
  }

  const versions = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => /^chromium_headless_shell-(\d+)$/.exec(entry.name))
    .filter(Boolean)
    .map((match) => ({ directory: match[0], revision: Number(match[1]) }))
    .sort((a, b) => b.revision - a.revision)

  if (versions.length === 0) {
    throw new Error(
      `No chromium_headless_shell-* directory was found in ${cache}. Install a Playwright Chromium browser before running brand:social.`,
    )
  }

  const newest = versions[0]
  const executable = path.join(
    cache,
    newest.directory,
    "chrome-headless-shell-mac-arm64/chrome-headless-shell",
  )

  try {
    await access(executable, constants.X_OK)
  } catch (error) {
    throw new Error(
      `The newest cached Chromium headless shell (${newest.directory}) has no executable at ${executable}. Reinstall that Playwright browser before running brand:social.`,
      { cause: error },
    )
  }

  return executable
}

function htmlTemplate() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      @font-face {
        font-family: "Bricolage Grotesque Social";
        src: url("${fileUrl(assets.bricolage)}") format("woff2-variations");
        font-style: normal;
        font-weight: 200 800;
        font-stretch: 75% 100%;
      }

      @font-face {
        font-family: "Instrument Sans Social";
        src: url("${fileUrl(assets.instrument)}") format("woff2-variations");
        font-style: normal;
        font-weight: 400 700;
        font-stretch: 75% 100%;
      }

      @font-face {
        font-family: "JetBrains Mono Social";
        src: url("${fileUrl(assets.jetbrains)}") format("woff2-variations");
        font-style: normal;
        font-weight: 100 800;
      }

      * { box-sizing: border-box; }

      html,
      body {
        width: ${CARD_WIDTH}px;
        height: ${CARD_HEIGHT}px;
        margin: 0;
        overflow: hidden;
        background: oklch(0.105 0.038 272);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .card {
        position: relative;
        isolation: isolate;
        width: ${CARD_WIDTH}px;
        height: ${CARD_HEIGHT}px;
        overflow: hidden;
        color: #f5f6ff;
      }

      .background,
      .scrim,
      .grain {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .background {
        z-index: 0;
        background-image: url("${fileUrl(assets.background)}");
        background-position: right center;
        background-repeat: no-repeat;
        background-size: cover;
      }

      .scrim {
        z-index: 1;
        background: linear-gradient(
          90deg,
          oklch(0.105 0.038 272 / 0.97) 0%,
          oklch(0.105 0.038 272 / 0.85) 50%,
          oklch(0.105 0.038 272 / 0) 78%
        );
      }

      .grain {
        z-index: 2;
        background-image: url("${fileUrl(assets.grain)}");
        background-repeat: repeat;
        background-size: 320px 320px;
        mix-blend-mode: screen;
        opacity: 0.12;
      }

      .lockup,
      .message,
      .footer {
        position: absolute;
        z-index: 3;
        left: 78px;
      }

      .lockup {
        top: 78px;
        display: flex;
        align-items: center;
        gap: 13px;
        height: 44px;
      }

      .lockup img {
        display: block;
        width: 44px;
        height: 44px;
      }

      .wordmark {
        margin-top: -1px;
        font-family: "Instrument Sans Social", sans-serif;
        font-size: 27px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: -0.01em;
      }

      .message {
        top: 181px;
        width: 650px;
      }

      .kicker,
      .footer {
        font-family: "JetBrains Mono Social", monospace;
        color: oklch(0.78 0.13 278);
        letter-spacing: 0.09em;
      }

      .kicker {
        margin: 0 0 14px 2px;
        font-size: 15px;
        font-weight: 600;
        line-height: 1.4;
        text-transform: uppercase;
      }

      .headline {
        max-width: 630px;
        margin: 0;
        font-family: "Bricolage Grotesque Social", sans-serif;
        font-size: 68px;
        font-weight: 600;
        font-optical-sizing: auto;
        font-variation-settings: "opsz" 96, "wght" 600;
        line-height: 1.03;
        letter-spacing: -0.03em;
        text-wrap: balance;
      }

      .body {
        max-width: 560px;
        text-wrap: balance;
        margin: 18px 0 0 2px;
        color: oklch(0.85 0.03 278);
        font-family: "Instrument Sans Social", sans-serif;
        font-size: 24px;
        font-weight: 400;
        line-height: 1.45;
        text-wrap: pretty;
      }

      .footer {
        bottom: 78px;
        font-size: 17px;
        font-weight: 600;
        line-height: 1.4;
        text-transform: lowercase;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="background"></div>
      <div class="scrim"></div>
      <div class="grain"></div>
      <div class="lockup">
        <img src="${fileUrl(assets.logo)}" alt="" />
        <div class="wordmark">Postbag</div>
      </div>
      <section class="message">
        <p class="kicker"></p>
        <h1 class="headline"></h1>
        <p class="body"></p>
      </section>
      <div class="footer">postbag.dev</div>
    </main>
  </body>
</html>`
}

async function assertAssets() {
  for (const [name, file] of Object.entries(assets)) {
    try {
      await access(file)
    } catch (error) {
      throw new Error(`Missing social-card ${name} asset: ${file}`, { cause: error })
    }
  }
}

async function populateCard(page, card) {
  await page.evaluate(({ kicker, title, body }) => {
    document.querySelector(".kicker").textContent = kicker
    document.querySelector(".body").textContent = body

    const headline = document.querySelector(".headline")
    headline.replaceChildren()
    title.forEach((line, index) => {
      if (index > 0) headline.append(document.createElement("br"))
      headline.append(document.createTextNode(line))
    })
  }, card)

  await page.evaluate(async () => {
    await document.fonts.ready
  })

  const fontState = await page.evaluate(() => ({
    status: document.fonts.status,
    bricolage: document.fonts.check('600 68px "Bricolage Grotesque Social"'),
    instrument: document.fonts.check('600 27px "Instrument Sans Social"'),
    jetbrains: document.fonts.check('600 15px "JetBrains Mono Social"'),
    loadedFaces: [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => face.family),
  }))

  const requiredFamilies = [
    "Bricolage Grotesque Social",
    "Instrument Sans Social",
    "JetBrains Mono Social",
  ]
  const missingFamily = requiredFamilies.find(
    (family) => !fontState.loadedFaces.some((loaded) => loaded.includes(family)),
  )

  if (
    fontState.status !== "loaded" ||
    !fontState.bricolage ||
    !fontState.instrument ||
    !fontState.jetbrains ||
    missingFamily
  ) {
    throw new Error(
      `Brand fonts did not load before capture: ${JSON.stringify(fontState)}. Refusing to render fallback typography.`,
    )
  }
}

async function compressedPng(screenshot) {
  for (const quality of [92, 88, 84, 80]) {
    const png = await sharp(screenshot)
      .resize(CARD_WIDTH, CARD_HEIGHT, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .png({
        compressionLevel: 9,
        palette: true,
        quality,
        colours: 256,
        dither: 0.9,
        effort: 10,
      })
      .toBuffer()

    if (png.byteLength <= MAX_BYTES) return png
  }

  throw new Error(`Could not compress a social card below ${MAX_BYTES} bytes without leaving the quality range.`)
}

async function main() {
  await assertAssets()
  await mkdir(output, { recursive: true })

  const executablePath = await newestChromiumExecutable()
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "postbag-social-"))
  const temporaryHtml = path.join(temporaryDirectory, "social-card.html")
  await writeFile(temporaryHtml, htmlTemplate(), "utf8")

  let browser

  try {
    browser = await chromium.launch({
      executablePath,
      headless: true,
      args: ["--allow-file-access-from-files", "--single-process", "--no-zygote"],
    })

    const context = await browser.newContext({
      viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
      deviceScaleFactor: 2,
    })
    const page = await context.newPage()
    page.on("pageerror", (error) => console.error(`Social-card page error: ${error.message}`))

    await page.goto(fileUrl(temporaryHtml), { waitUntil: "load" })

    for (const [name, card] of Object.entries(cards)) {
      await populateCard(page, card)

      const screenshot = await page.screenshot({
        type: "png",
        animations: "disabled",
        scale: "device",
      })
      const png = await compressedPng(screenshot)
      const destination = path.join(output, `${name}.png`)
      await writeFile(destination, png)

      const metadata = await sharp(destination).metadata()
      const { size } = await stat(destination)
      if (metadata.width !== CARD_WIDTH || metadata.height !== CARD_HEIGHT || size > MAX_BYTES) {
        throw new Error(
          `${name}.png failed output constraints: ${metadata.width}x${metadata.height}, ${size} bytes.`,
        )
      }

      console.log(`${name}.png: ${metadata.width}x${metadata.height}, ${(size / 1024).toFixed(1)} KB`)
    }

    await context.close()
  } finally {
    await browser?.close()
    await rm(temporaryDirectory, { recursive: true, force: true })
  }

  console.log(`Generated ${Object.keys(cards).length} browser-rendered social images in ${output}`)
}

const entrypoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined
if (entrypoint === import.meta.url) await main()
