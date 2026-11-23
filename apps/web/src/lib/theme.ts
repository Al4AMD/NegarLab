export type Theme = "dark" | "light";

const STORAGE_KEY = "negarlab-theme";

export function getInitialTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
}
