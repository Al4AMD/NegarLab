import { useTranslation } from "react-i18next";
import { SystemCheck } from "./SystemCheck";

export function TransportBar() {
  const { t } = useTranslation();

  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-edge bg-panel px-4 py-2 text-xs text-slate">
      <span>{t("transport.ready")}</span>
      <SystemCheck />
    </footer>
  );
}
