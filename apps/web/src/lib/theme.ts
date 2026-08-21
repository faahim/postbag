export type ThemePreference = "light" | "dark" | "system"

const STORAGE_KEY = "postbag-theme"

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

function resolve(preference: ThemePreference): "light" | "dark" {
  return preference === "system" ? (systemPrefersDark() ? "dark" : "light") : preference
}

function apply(preference: ThemePreference): void {
  document.documentElement.setAttribute("data-theme", resolve(preference))
}

export function getThemePreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark" || stored === "system") return stored
  return "system"
}

export function setThemePreference(preference: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, preference)
  apply(preference)
}

/** Applies the stored (or system) theme before first paint and keeps it in sync with the OS
 * setting while the preference is "system". Call once, as early as possible. */
export function initTheme(): void {
  apply(getThemePreference())
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getThemePreference() === "system") apply("system")
  })
}
