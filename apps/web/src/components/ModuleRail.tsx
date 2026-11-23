import { useState } from "react";
import { useTranslation } from "react-i18next";

export const MODULE_IDS = [
  "I01",
  "I02",
  "I03",
  "I04",
  "I05",
  "I06",
  "I07",
  "I08",
  "I09",
  "I10",
  "I11",
  "I12",
  "I13",
  "I14",
] as const;

export function ModuleRail() {
  const { t } = useTranslation();
  const [active, setActive] = useState<string>(MODULE_IDS[0]);

  return (
    <aside
      className="border-edge bg-panel lg:border-e"
      aria-label={t("rail.title")}
      data-testid="module-rail"
    >
      <h2 className="px-3 pt-3 text-[10px] uppercase tracking-[0.18em] text-slate">
        {t("rail.title")}
      </h2>
      <ul className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible">
        {MODULE_IDS.map((id) => {
          const isActive = active === id;
          return (
            <li key={id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => setActive(id)}
                aria-current={isActive ? "true" : undefined}
                data-testid={`module-${id}`}
                className={`flex items-center gap-2 rounded-sm border-s-2 px-2 py-2 text-start text-xs transition-colors lg:w-full ${
                  isActive
                    ? "border-safelight bg-surface text-chalk"
                    : "border-transparent text-slate hover:text-chalk"
                }`}
              >
                <span className="numeric text-[10px] text-slate">{id}</span>
                <span className="whitespace-nowrap">{t(`modules.${id}.title`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
