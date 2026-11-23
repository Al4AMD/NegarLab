import { useTranslation } from "react-i18next";
import { applyLanguage } from "../i18n";
import { GlobeIcon } from "./Icons";

export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage === "en" ? "en" : "fa";
  const next = current === "fa" ? "en" : "fa";
  const label = t("header.languageLabel");

  return (
    <button
      type="button"
      onClick={() => {
        applyLanguage(next);
        void i18n.changeLanguage(next);
      }}
      aria-label={label}
      title={label}
      data-testid="language-toggle"
      className="flex h-9 items-center gap-2 rounded-sm border border-edge px-2 text-slate transition-colors hover:border-safelight hover:text-chalk"
    >
      <GlobeIcon className="size-4" />
      <span className="numeric text-[11px] font-medium">{next === "en" ? "EN" : "FA"}</span>
    </button>
  );
}
