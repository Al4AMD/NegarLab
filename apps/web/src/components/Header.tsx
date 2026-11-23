import { useTranslation } from "react-i18next";
import type { Theme } from "../lib/theme";
import { HealthBadge } from "./HealthBadge";
import { ApertureMark } from "./Icons";
import { LanguageToggle } from "./LanguageToggle";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export function Header({ theme, onToggleTheme }: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge bg-panel px-4 py-3">
      <div className="flex items-center gap-3">
        <ApertureMark className="size-7 text-chalk" />
        <div>
          <p className="font-display text-lg leading-none tracking-tight">{t("app.name")}</p>
          <p className="mt-1 text-xs text-slate">{t("app.subtitle")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <HealthBadge />
        <LanguageToggle />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
