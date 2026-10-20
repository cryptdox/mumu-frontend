import { createStore } from "./store";

export type Theme = "system" | "light" | "dark";
const KEY = "mu.theme";

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export const themeStore = createStore<Theme>(read());
const media = window.matchMedia("(prefers-color-scheme: dark)");

function apply() {
  const t = themeStore.get();
  const dark = t === "dark" || (t === "system" && media.matches);
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#2f3640" : "#00a8ff");
}

export function setTheme(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    // ignore
  }
  themeStore.set(t);
  apply();
}

media.addEventListener("change", apply);
apply();
