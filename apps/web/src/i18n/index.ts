import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/common.json";
import fa from "./locales/fa/common.json";

export const SUPPORTED_LANGUAGES = ["fa", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "negarlab-lang";

function detectLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === "en" ? "en" : "fa";
}

export function applyLanguage(language: Language): void {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "fa" ? "rtl" : "ltr";
  localStorage.setItem(STORAGE_KEY, language);
}

export async function initI18n(): Promise<void> {
  const language = detectLanguage();
  await i18n.use(initReactI18next).init({
    resources: {
      fa: { common: fa },
      en: { common: en },
    },
    lng: language,
    fallbackLng: "fa",
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
  applyLanguage(language);
}

export default i18n;
