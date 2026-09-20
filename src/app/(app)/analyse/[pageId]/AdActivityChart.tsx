// Graphe d'activité publicitaire (pubs lancées par mois) — SVG, une seule
// série (hue unique = primary), barres fines à sommet arrondi, libellés directs.
export function AdActivityChart({ data }: { data: { key: string; label: string; value: number }[] }) {
  const W = 720;
  const H = 180;
  const padX = 8;
  const padTop = 22;
  const padBottom = 26;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const slot = (W - padX * 2) / n;
  const barW = Math.min(34, slot * 0.6);
  const plotH = H - padTop - padBottom;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[180px] w-full min-w-[560px]"
        role="img"
        aria-label="Nombre de pubs lancées par mois"
      >
        {/* Ligne de base */}
        <line x1={padX} y1={H - padBottom} x2={W - padX} y2={H - padBottom}
          style={{ stroke: "var(--color-border)" }} strokeWidth={1} />
        {data.map((d, i) => {
          const cx = padX + slot * i + slot / 2;
          const h = (d.value / max) * plotH;
          const y = H - padBottom - h;
          return (
            <g key={d.key}>
              <title>{`${d.label} : ${d.value} pub${d.value > 1 ? "s" : ""}`}</title>
              <rect
                x={cx - barW / 2}
                y={d.value > 0 ? y : H - padBottom - 2}
                width={barW}
                height={d.value > 0 ? h : 2}
                rx={4}
                style={{ fill: d.value > 0 ? "var(--color-primary)" : "var(--color-input)" }}
              />
              {d.value > 0 && (
                <text x={cx} y={y - 6} textAnchor="middle" style={{ fill: "var(--color-foreground)" }}
                  fontSize={11} fontWeight={600}>
                  {d.value}
                </text>
              )}
              <text x={cx} y={H - padBottom + 16} textAnchor="middle"
                style={{ fill: "var(--color-muted-foreground)" }} fontSize={10}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
