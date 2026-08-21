import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  type ConfigEnv,
  DEFAULT_API_URL,
  readCredentials,
  resolveConfig,
  saveProfile,
  writeCredentials,
  writePostbagJson,
} from "./config.js"

describe("resolveConfig", () => {
  let dir: string
  let configEnv: ConfigEnv

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "postbag-cli-config-"))
    mkdirSync(join(dir, "project"))
    configEnv = { env: {}, cwd: join(dir, "project"), homeDir: join(dir, "home") }
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("falls back to the default API URL with no other source", () => {
    const resolved = resolveConfig({}, configEnv)
    expect(resolved).toEqual({ apiUrl: DEFAULT_API_URL, apiKey: undefined })
  })

  it("prefers the saved credentials profile over the default", () => {
    saveProfile(configEnv, "default", { api_url: "https://from-credentials.example", api_key: "pb_from_creds" })
    const resolved = resolveConfig({}, configEnv)
    expect(resolved).toEqual({ apiUrl: "https://from-credentials.example", apiKey: "pb_from_creds" })
  })

  it("prefers postbag.json's api_url over the saved credentials (api_key is not read from it)", () => {
    saveProfile(configEnv, "default", { api_url: "https://from-credentials.example", api_key: "pb_from_creds" })
    writePostbagJson(configEnv.cwd, { api_url: "https://from-postbag-json.example" })
    const resolved = resolveConfig({}, configEnv)
    expect(resolved).toEqual({ apiUrl: "https://from-postbag-json.example", apiKey: "pb_from_creds" })
  })

  it("prefers env vars over postbag.json and credentials", () => {
    saveProfile(configEnv, "default", { api_url: "https://from-credentials.example", api_key: "pb_from_creds" })
    writePostbagJson(configEnv.cwd, { api_url: "https://from-postbag-json.example" })
    const withEnv: ConfigEnv = {
      ...configEnv,
      env: { POSTBAG_API_URL: "https://from-env.example", POSTBAG_API_KEY: "pb_from_env" },
    }
    const resolved = resolveConfig({}, withEnv)
    expect(resolved).toEqual({ apiUrl: "https://from-env.example", apiKey: "pb_from_env" })
  })

  it("prefers explicit flags over everything else", () => {
    saveProfile(configEnv, "default", { api_url: "https://from-credentials.example", api_key: "pb_from_creds" })
    const withEnv: ConfigEnv = {
      ...configEnv,
      env: { POSTBAG_API_URL: "https://from-env.example", POSTBAG_API_KEY: "pb_from_env" },
    }
    const resolved = resolveConfig({ apiUrl: "https://from-flag.example", apiKey: "pb_from_flag" }, withEnv)
    expect(resolved).toEqual({ apiUrl: "https://from-flag.example", apiKey: "pb_from_flag" })
  })
})

describe("credentials file", () => {
  let dir: string
  let configEnv: ConfigEnv

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "postbag-cli-config-"))
    configEnv = { env: {}, cwd: dir, homeDir: join(dir, "home") }
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("is written with mode 0600", () => {
    writeCredentials(configEnv, { profiles: { default: { api_key: "pb_secret" } }, current: "default" })
    const path = join(configEnv.homeDir, ".config", "postbag", "credentials.json")
    const mode = statSync(path).mode & 0o777
    expect(mode).toBe(0o600)
  })

  it("respects XDG_CONFIG_HOME", () => {
    const xdg = join(dir, "xdg")
    const envWithXdg: ConfigEnv = { ...configEnv, env: { XDG_CONFIG_HOME: xdg } }
    writeCredentials(envWithXdg, { profiles: { default: { api_key: "pb_secret" } }, current: "default" })
    const path = join(xdg, "postbag", "credentials.json")
    expect(readFileSync(path, "utf8")).toContain("pb_secret")
  })

  it("saveProfile merges into any existing profiles and switches current", () => {
    saveProfile(configEnv, "work", { api_url: "https://work.example", api_key: "pb_work" })
    saveProfile(configEnv, "personal", { api_url: "https://personal.example", api_key: "pb_personal" })
    const file = readCredentials(configEnv)
    expect(file?.current).toBe("personal")
    expect(file?.profiles["work"]).toEqual({ api_url: "https://work.example", api_key: "pb_work" })
    expect(file?.profiles["personal"]).toEqual({ api_url: "https://personal.example", api_key: "pb_personal" })
  })
})

describe("writePostbagJson", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "postbag-cli-config-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("creates the file when none exists", () => {
    const written = writePostbagJson(dir, { form_id: "fm_1", submit_url: "https://x/s/fm_1" })
    expect(written).toEqual({ form_id: "fm_1", submit_url: "https://x/s/fm_1" })
    expect(JSON.parse(readFileSync(join(dir, "postbag.json"), "utf8"))).toEqual(written)
  })

  it("merges into an existing file, preserving unrelated keys", () => {
    writeFileSync(join(dir, "postbag.json"), JSON.stringify({ custom: "keep-me", project: "old" }))
    const written = writePostbagJson(dir, { form_id: "fm_1", project: "new" })
    expect(written).toEqual({ custom: "keep-me", project: "new", form_id: "fm_1" })
  })
})
