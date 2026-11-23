import { useTranslation } from "react-i18next";

interface HistogramViewProps {
  counts: Uint32Array;
}

export function HistogramView({ counts }: HistogramViewProps) {
  const { t } = useTranslation();
  const max = Math.max(1, ...Array.from(counts));

  return (
    <div data-testid="histogram-view">
      <div className="flex items-end gap-px border border-edge bg-ink p-1" aria-hidden="true">
        {Array.from(counts).map((count, bin) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: histogram bins are positional
            key={`bin-${bin}`}
            className="min-w-0 flex-1 bg-signal"
            style={{ height: `${Math.max(1, (count / max) * 64)}px` }}
          />
        ))}
      </div>
      <p className="mt-1 text-right text-[10px] text-slate numeric">0 – 255</p>
      <p className="sr-only">{t("dock.histogram.caption")}</p>
    </div>
  );
}
