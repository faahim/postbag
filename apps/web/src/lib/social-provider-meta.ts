import { GitHubMark, GoogleMark } from "@/components/social-icons"
import type { SocialProvider } from "@/lib/queries/auth-providers"

/** Shared between `SocialButtons` (sign-in/sign-up) and the settings "Connected accounts"
 * card, so the label/icon/button copy for a provider is defined exactly once. */
export const SOCIAL_PROVIDER_NAME: Record<SocialProvider, string> = {
  google: "Google",
  github: "GitHub",
}

export const SOCIAL_PROVIDER_BUTTON_LABEL: Record<SocialProvider, string> = {
  google: "Continue with Google",
  github: "Continue with GitHub",
}

export const SOCIAL_PROVIDER_ICON: Record<SocialProvider, typeof GoogleMark> = {
  google: GoogleMark,
  github: GitHubMark,
}
