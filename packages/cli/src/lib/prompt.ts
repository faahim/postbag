import readline from "node:readline"

export type PromptIo = {
  readonly input: NodeJS.ReadableStream
  readonly output: NodeJS.WritableStream
}

export function defaultPromptIo(): PromptIo {
  return { input: process.stdin, output: process.stdout }
}

/** Asks a plain question on `output`/`input`, returning the trimmed answer (or `defaultValue`). */
export async function prompt(question: string, defaultValue: string | undefined, io: PromptIo): Promise<string> {
  const suffix = defaultValue === undefined || defaultValue === "" ? "" : ` (${defaultValue})`
  const rl = readline.createInterface({ input: io.input, output: io.output, terminal: true })
  const answer = await new Promise<string>((resolve) => {
    rl.question(`${question}${suffix}: `, resolve)
  })
  rl.close()
  const trimmed = answer.trim()
  return trimmed === "" ? (defaultValue ?? "") : trimmed
}

type InternalReadline = readline.Interface & { _writeToOutput?: (text: string) => void }

/** Asks a question without echoing the answer to the terminal (for API keys). */
export async function promptHidden(question: string, io: PromptIo): Promise<string> {
  const rl = readline.createInterface({ input: io.input, output: io.output, terminal: true })
  io.output.write(`${question}: `)
  // `readline` has no public "mask this input" option; muting the internal echo
  // hook (after writing the prompt text ourselves) is the standard workaround
  // used by npm's own `npm login`, among others.
  const internal = rl as InternalReadline
  internal._writeToOutput = () => {
    // Suppress echo entirely — no prompt, no asterisks, matching a typical password field.
  }
  const answer = await new Promise<string>((resolve) => {
    rl.question("", resolve)
  })
  rl.close()
  io.output.write("\n")
  return answer.trim()
}
