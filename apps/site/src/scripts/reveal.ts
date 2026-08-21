import { inView } from "motion"

// Scroll reveals: elements with [data-reveal] get data-in when they enter the viewport.
// Stagger siblings via --reveal-delay set inline or through [data-reveal-group].
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

function setup() {
  document.documentElement.classList.add("reveal-ready")
  const groups = document.querySelectorAll<HTMLElement>("[data-reveal-group]")
  groups.forEach((group) => {
    const step = Number(group.dataset.revealGroup ?? "70") || 70
    group.querySelectorAll<HTMLElement>(":scope [data-reveal]").forEach((el, i) => {
      if (!el.style.getPropertyValue("--reveal-delay")) el.style.setProperty("--reveal-delay", `${i * step}ms`)
    })
  })
  const els = document.querySelectorAll<HTMLElement>("[data-reveal]")
  if (reduce) {
    els.forEach((el) => {
      el.setAttribute("data-in", "")
    })
    return
  }
  els.forEach((el) => {
    inView(
      el,
      () => {
        el.setAttribute("data-in", "")
      },
      { margin: "0px 0px -12% 0px", amount: 0.15 },
    )
  })
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setup)
else setup()
