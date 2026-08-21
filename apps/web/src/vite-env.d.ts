/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set (to any non-empty value) only on the hosted build. Job G 2a: lets the sign-in/
   * sign-up screens reserve layout space for social buttons while `/v1/auth/providers` is
   * still loading, since the hosted instance always has at least one provider configured.
   * Self-host builds don't set this — they render nothing until the real answer arrives. */
  readonly VITE_HOSTED?: string
}
