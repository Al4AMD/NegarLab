import katex from "katex";
import "katex/dist/katex.min.css";
import { useTranslation } from "react-i18next";

export type TheoryTopic = "inspect" | "point" | "sampling";

const FORMULAS: Record<TheoryTopic, string> = {
  inspect:
    "\\bar{x}=\\tfrac{1}{N}\\sum_i x_i,\\quad \\sigma^2=\\tfrac{1}{N}\\sum_i (x_i-\\bar{x})^2,\\quad H=-\\sum_k p_k\\log_2 p_k",
  point:
    "s=\\frac{\\operatorname{cdf}(r)-\\operatorname{cdf}_{\\min}}{1-\\operatorname{cdf}_{\\min}},\\quad s=v^{\\gamma},\\quad s=\\frac{\\log(1+255v)}{\\log 256}",
  sampling:
    "s_q=\\frac{\\operatorname{round}(v\\,(2^b-1))}{2^b-1},\\quad x'=\\left\\lfloor x\\,\\frac{W_s}{W_d}\\right\\rfloor",
};

export function TheoryPanel({ topic }: { topic: TheoryTopic }) {
  const { t } = useTranslation();

  return (
    <details className="border border-edge bg-ink/40 px-3 py-2">
      <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-slate">
        {t("theory.title")}
      </summary>
      <div
        dir="ltr"
        className="mt-2 overflow-x-auto text-xs text-chalk"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output from static local formulas
        dangerouslySetInnerHTML={{
          __html: katex.renderToString(FORMULAS[topic], {
            throwOnError: false,
            displayMode: true,
          }),
        }}
      />
      <p className="mt-2 text-xs leading-5 text-slate">{t(`theory.${topic}`)}</p>
    </details>
  );
}
