import katex from "katex";
import "katex/dist/katex.min.css";
import { useTranslation } from "react-i18next";

export type TheoryTopic =
  | "inspect"
  | "point"
  | "sampling"
  | "spatial"
  | "frequency"
  | "compression"
  | "metrics"
  | "color"
  | "morphology"
  | "geometry"
  | "halftone";

const FORMULAS: Record<TheoryTopic, string> = {
  inspect:
    "\\bar{x}=\\tfrac{1}{N}\\sum_i x_i,\\quad \\sigma^2=\\tfrac{1}{N}\\sum_i (x_i-\\bar{x})^2,\\quad H=-\\sum_k p_k\\log_2 p_k",
  point:
    "s=\\frac{\\operatorname{cdf}(r)-\\operatorname{cdf}_{\\min}}{1-\\operatorname{cdf}_{\\min}},\\quad s=v^{\\gamma},\\quad s=\\frac{\\log(1+255v)}{\\log 256}",
  sampling:
    "s_q=\\frac{\\operatorname{round}(v\\,(2^b-1))}{2^b-1},\\quad x'=\\left\\lfloor x\\,\\frac{W_s}{W_d}\\right\\rfloor",
  spatial:
    "g(x,y)=\\sum_s\\sum_t w(s,t)\\,f(x-s,y-t),\\quad G_\\sigma=\\frac{1}{2\\pi\\sigma^2}e^{-(x^2+y^2)/(2\\sigma^2)}",
  frequency: "F(u,v)=\\sum_x\\sum_y f(x,y)\\,e^{-2\\pi i(ux/M+vy/N)}",
  compression:
    "F(u,v)=\\tfrac{1}{4}C(u)C(v)\\sum_x\\sum_y f(x,y)\\cos\\tfrac{(2x+1)u\\pi}{16}\\cos\\tfrac{(2y+1)v\\pi}{16},\\quad \\hat F=\\operatorname{round}\\left(\\frac{F}{Q}\\right)",
  color: "Y=0.299R+0.587G+0.114B,\\quad L=116f(Y)-16",
  morphology:
    "A\\ominus B=\\{z\\mid B_z\\subseteq A\\},\\quad A\\oplus B=\\{z\\mid \\hat B_z\\cap A\\neq\\varnothing\\}",
  geometry:
    "\\begin{bmatrix}x'\\\\y'\\\\1\\end{bmatrix}=H\\begin{bmatrix}x\\\\y\\\\1\\end{bmatrix}",
  halftone: "e(x,y)=f(x,y)-b(x,y),\\quad b=\\begin{cases}255&f\\ge T\\\\0&f<T\\end{cases}",
  metrics:
    "\\mathrm{MSE}=\\tfrac{1}{3N}\\sum_i\\sum_c (x_{i,c}-y_{i,c})^2,\\quad \\mathrm{PSNR}=10\\log_{10}\\frac{255^2}{\\mathrm{MSE}},\\quad \\mathrm{SSIM}=\\frac{(2\\mu_x\\mu_y+C_1)(2\\sigma_{xy}+C_2)}{(\\mu_x^2+\\mu_y^2+C_1)(\\sigma_x^2+\\sigma_y^2+C_2)}",
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
