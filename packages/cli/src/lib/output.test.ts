import { describe, expect, it } from "vitest"

import { type Io, printData, printError, shouldUseJson } from "./output.js"

function fakeIo(): { io: Io; logs: string[]; errors: string[] } {
  const logs: string[] = []
  const errors: string[] = []
  return {
    logs,
    errors,
    io: {
      log: (line) => {
        logs.push(line)
      },
      error: (line) => {
        errors.push(line)
      },
    },
  }
}

describe("shouldUseJson", () => {
  it("is JSON when stdout is not a TTY, even without --json", () => {
    expect(shouldUseJson(undefined, false)).toBe(true)
  })

  it("is JSON when --json is passed, even on a TTY", () => {
    expect(shouldUseJson(true, true)).toBe(true)
  })

  it("is human (table) mode on a TTY without --json", () => {
    expect(shouldUseJson(undefined, true)).toBe(false)
  })
})

describe("printData", () => {
  it("prints pretty JSON in JSON mode, whatever the shape", () => {
    const { io, logs } = fakeIo()
    printData(io, { id: "fm_1", name: "Contact" }, true)
    expect(logs).toEqual([JSON.stringify({ id: "fm_1", name: "Contact" }, null, 2)])
    expect(JSON.parse(logs[0] ?? "")).toEqual({ id: "fm_1", name: "Contact" })
  })

  it("renders a list of objects as an aligned table in human mode, id column first", () => {
    const { io, logs } = fakeIo()
    printData(
      io,
      [
        { name: "Contact", id: "fm_1" },
        { name: "Newsletter signup", id: "fm_2" },
      ],
      false,
    )
    expect(logs).toHaveLength(1)
    const [table] = logs
    const lines = (table ?? "").split("\n")
    expect(lines[0]?.startsWith("id")).toBe(true)
    expect(lines[1]).toContain("fm_1")
    expect(lines[2]).toContain("fm_2")
  })

  it("renders a single object as key: value lines in human mode", () => {
    const { io, logs } = fakeIo()
    printData(io, { id: "fm_1", name: "Contact" }, false)
    expect(logs[0]).toContain("id")
    expect(logs[0]).toContain("fm_1")
  })
})

describe("printError", () => {
  it("prints { error } as JSON on stderr in JSON mode", () => {
    const { io, errors } = fakeIo()
    const code = printError(io, { code: "not_found", message: "No such form.", hint: "Check the id.", docs: "https://postbag.dev/docs/errors#not_found" }, true)
    expect(code).toBe(1)
    expect(JSON.parse(errors[0] ?? "")).toEqual({
      error: {
        code: "not_found",
        message: "No such form.",
        hint: "Check the id.",
        docs: "https://postbag.dev/docs/errors#not_found",
      },
    })
  })

  it("prints code: message, then hint: and docs: lines in human mode", () => {
    const { io, errors } = fakeIo()
    printError(io, { code: "not_found", message: "No such form.", hint: "Check the id.", docs: "https://x/docs" }, false)
    expect(errors).toEqual(["not_found: No such form.", "hint: Check the id.", "docs: https://x/docs"])
  })

  it("omits hint/docs lines when absent", () => {
    const { io, errors } = fakeIo()
    printError(io, { code: "internal_error", message: "Something broke." }, false)
    expect(errors).toEqual(["internal_error: Something broke."])
  })
})
