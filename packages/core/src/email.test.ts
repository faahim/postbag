import { describe, expect, it } from "vitest"

import { normalizeMailbox, sameMailbox } from "./email.js"

describe("normalizeMailbox", () => {
  it("folds case and whitespace everywhere", () => {
    expect(normalizeMailbox("  Eric.Kurtto@Example.COM ")).toBe("eric.kurtto@example.com")
  })

  it("strips +tags everywhere", () => {
    expect(normalizeMailbox("eric+postbag@example.com")).toBe("eric@example.com")
    expect(normalizeMailbox("eric+a+b@example.com")).toBe("eric@example.com")
  })

  it("ignores dots only on Gmail, and folds googlemail.com into gmail.com", () => {
    expect(normalizeMailbox("afiur.fahim@gmail.com")).toBe("afiurfahim@gmail.com")
    expect(normalizeMailbox("a.f.i.u.r.fahim+x@googlemail.com")).toBe("afiurfahim@gmail.com")
    expect(normalizeMailbox("first.last@example.com")).toBe("first.last@example.com")
  })

  it("leaves non-addresses alone apart from case/whitespace", () => {
    expect(normalizeMailbox("not-an-email")).toBe("not-an-email")
    expect(normalizeMailbox("@example.com")).toBe("@example.com")
    expect(normalizeMailbox("eric@")).toBe("eric@")
  })
})

describe("sameMailbox", () => {
  it("matches the Gmail dot/tag variants and nothing else", () => {
    expect(sameMailbox("afiurfahim@gmail.com", "Afiur.Fahim@gmail.com")).toBe(true)
    expect(sameMailbox("afiurfahim@gmail.com", "afiur.fahim+eric@googlemail.com")).toBe(true)
    expect(sameMailbox("eric@example.com", "eric+x@example.com")).toBe(true)
    expect(sameMailbox("eric.k@example.com", "erick@example.com")).toBe(false)
    expect(sameMailbox("eric@example.com", "eric@example.org")).toBe(false)
  })
})
