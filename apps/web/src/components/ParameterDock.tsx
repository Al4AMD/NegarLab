import { useTranslation } from "react-i18next";

export function ParameterDock() {
  const { t } = useTranslation();

  return (
    <aside
      className="border-edge bg-panel p-4 lg:border-s"
      aria-label={t("dock.title")}
      data-testid="parameter-dock"
    >
      <h2 className="text-[10px] uppercase tracking-[0.18em] text-slate">{t("dock.title")}</h2>
      <div className="mt-3 border border-dashed border-edge p-4">
        <p className="text-sm text-chalk">{t("dock.empty.title")}</p>
        <p className="mt-1 text-xs leading-5 text-slate">{t("dock.empty.body")}</p>
      </div>
    </aside>
  );
}
