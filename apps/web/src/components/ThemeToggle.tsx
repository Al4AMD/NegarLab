import { useTranslation } from "react-i18next";
import type { Theme } from "../lib/theme";
import { MoonIcon, SunIcon } from "./Icons";

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const { t } = useTranslation();
  const label = t("header.themeLabel");

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={theme === "light"}
      title={label}
      data-testid="theme-toggle"
      className="grid size-9 place-items-center rounded-sm border border-edge text-slate transition-colors hover:border-safelight hover:text-chalk"
    >
      {theme === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </button>
  );
}
