export const ID_PREFIXES = [
  "org",
  "usr",
  "key",
  "prj",
  "fm",
  "fs",
  "sb",
  "st",
  "ss",
  "src",
  "ds",
  "rt",
  "dl",
  "dg",
  "ev",
  "dr",
  "wh",
  "whd",
  "fsd",
  "fl",
  "pg",
  "pgr",
  "be",
  "iv",
] as const

export type IdPrefix = (typeof ID_PREFIXES)[number]

export type ParsedId = {
  readonly prefix: IdPrefix
  readonly value: string
}

const ID_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz"
const ID_LENGTH = 12
const RANDOM_CEILING = Math.floor(256 / ID_ALPHABET.length) * ID_ALPHABET.length

function isIdPrefix(value: string): value is IdPrefix {
  return ID_PREFIXES.some((prefix) => prefix === value)
}

export function newId(prefix: IdPrefix): string {
  let value = ""
  const random = new Uint8Array(ID_LENGTH * 2)

  while (value.length < ID_LENGTH) {
    globalThis.crypto.getRandomValues(random)
    for (const byte of random) {
      if (byte >= RANDOM_CEILING) continue
      const character = ID_ALPHABET[byte % ID_ALPHABET.length]
      if (character !== undefined) value += character
      if (value.length === ID_LENGTH) break
    }
  }

  return `${prefix}_${value}`
}

export function parseId(id: string): ParsedId | null {
  const separator = id.indexOf("_")
  if (separator < 1) return null
  const prefix = id.slice(0, separator)
  const value = id.slice(separator + 1)
  if (!isIdPrefix(prefix) || value.length !== ID_LENGTH) return null
  for (const character of value) {
    if (!ID_ALPHABET.includes(character)) return null
  }
  return { prefix, value }
}
