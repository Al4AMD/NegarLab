import type { RgbaImage } from "@negarlab/ip";
import { useTranslation } from "react-i18next";
import { lumaMatrix, samplePixel } from "../lib/inspector";

interface InspectorProps {
  image: RgbaImage;
  selected: { x: number; y: number } | null;
}

export function Inspector({ image, selected }: InspectorProps) {
  const { t } = useTranslation();

  if (!selected) {
    return <p className="text-xs text-slate">{t("dock.inspector.hint")}</p>;
  }

  const pixel = samplePixel(image, selected.x, selected.y);
  if (!pixel) return <p className="text-xs text-slate">{t("dock.inspector.hint")}</p>;

  return (
    <div data-testid="inspector">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-slate">{t("dock.inspector.position")}</dt>
        <dd className="numeric">
          {pixel.x}, {pixel.y}
        </dd>
        <dt className="text-slate">RGBA</dt>
        <dd className="numeric">
          {pixel.r}, {pixel.g}, {pixel.b}, {pixel.a}
        </dd>
        <dt className="text-slate">{t("dock.inspector.luma")}</dt>
        <dd className="numeric">{pixel.luma}</dd>
      </dl>
      <div className="mt-2 overflow-x-auto" data-testid="inspector-matrix">
        <table className="numeric border-collapse text-[9px]">
          <tbody>
            {lumaMatrix(image, selected.x, selected.y).map((row, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed 8x8 matrix grid
              <tr key={`row-${rowIndex}`}>
                {row.map((value, colIndex) => (
                  <td
                    // biome-ignore lint/suspicious/noArrayIndexKey: fixed 8x8 matrix grid
                    key={`cell-${rowIndex}-${colIndex}`}
                    className={`border border-edge px-1 py-0.5 text-center ${
                      rowIndex === 3 && colIndex === 3 ? "bg-safelight text-ink" : ""
                    }`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
