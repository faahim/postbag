export type VerifyWebhookOptions = {
  readonly now?: number
  readonly toleranceSeconds?: number
}

const encoder = new TextEncoder()

async function signatureHex(secret: string, timestamp: number, body: string): Promise<string> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const result = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${body}`),
  )
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = encoder.encode(left)
  const rightBytes = encoder.encode(right)
  let difference = leftBytes.length ^ rightBytes.length
  const length = Math.max(leftBytes.length, rightBytes.length)
  for (let index = 0; index < length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }
  return difference === 0
}

export async function signWebhook(
  secret: string,
  timestamp: number,
  body: string,
): Promise<string> {
  const signature = await signatureHex(secret, timestamp, body)
  return `t=${timestamp},v1=${signature}`
}

export async function verifyWebhookSignature(
  secret: string,
  signatureHeader: string,
  body: string,
  options: VerifyWebhookOptions = {},
): Promise<boolean> {
  const match = /^t=(\d+),v1=([a-f0-9]{64})$/.exec(signatureHeader)
  const timestampText = match?.[1]
  const supplied = match?.[2]
  if (timestampText === undefined || supplied === undefined) return false
  const timestamp = Number.parseInt(timestampText, 10)
  const now = options.now ?? Math.floor(Date.now() / 1_000)
  const tolerance = options.toleranceSeconds ?? 300
  if (Math.abs(now - timestamp) > tolerance) return false
  const expected = await signatureHex(secret, timestamp, body)
  return constantTimeEqual(supplied, expected)
}
