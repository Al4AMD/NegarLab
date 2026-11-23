import { useTranslation } from "react-i18next";
import { ApertureMark } from "./Icons";

const CORNERS = [
  "-start-px -top-px border-s-2 border-t-2",
  "-end-px -top-px border-e-2 border-t-2",
  "-start-px -bottom-px border-s-2 border-b-2",
  "-end-px -bottom-px border-e-2 border-b-2",
];

export function Stage() {
  const { t } = useTranslation();

  return (
    <main
      className="flex min-h-[46vh] items-center justify-center border-edge p-4 lg:min-h-0 lg:p-8"
      aria-label={t("stage.empty.title")}
      data-testid="stage"
    >
      <div className="relative w-full max-w-xl border border-edge bg-panel px-6 py-14 text-center">
        {CORNERS.map((corner) => (
          <span
            key={corner}
            aria-hidden="true"
            className={`absolute size-3 border-safelight ${corner}`}
          />
        ))}
        <ApertureMark className="mx-auto size-10 text-slate" />
        <h2 className="mt-4 font-display text-lg">{t("stage.empty.title")}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate">
          {t("stage.empty.body")}
        </p>
      </div>
    </main>
  );
}
