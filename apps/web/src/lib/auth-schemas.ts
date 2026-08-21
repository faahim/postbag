import { z } from "zod"

export const signInSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
})
export type SignInValues = z.infer<typeof signInSchema>

export const signUpSchema = z.object({
  name: z.string().min(1, "Tell us what to call you."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "At least 8 characters."),
})
export type SignUpValues = z.infer<typeof signUpSchema>
