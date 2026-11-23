import { useTranslation } from "react-i18next";
import { useHealth } from "../lib/health";

const DOT: Record<"checking" | "online" | "offline", string> = {
  checking: "bg-slate",
  online: "bg-signal",
  offline: "bg-safelight",
};

export function HealthBadge() {
  const { t } = useTranslation();
  const status = useHealth();
  const label = t(`header.health.${status}`);

  return (
    <span
      title={t("header.healthLabel")}
      data-testid="health-badge"
      className="flex h-9 items-center gap-2 rounded-sm border border-edge px-2 text-[11px] text-slate"
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${DOT[status]}`} />
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </span>
  );
}
