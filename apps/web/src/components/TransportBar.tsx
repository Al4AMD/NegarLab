import { useTranslation } from "react-i18next";

export function TransportBar() {
  const { t } = useTranslation();

  return (
    <footer className="flex items-center justify-between gap-4 border-t border-edge bg-panel px-4 py-2 text-xs text-slate">
      <span>{t("transport.ready")}</span>
      <span className="numeric text-[10px] uppercase tracking-[0.18em]">W0</span>
    </footer>
  );
}
