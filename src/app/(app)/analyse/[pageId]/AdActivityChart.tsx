// Graphe d'activité publicitaire (pubs lancées par mois) — courbe d'aire
// labellisée (une seule série, teinte primary), inspirée des outils data mais
// en thème clair. SVG pur, aucune lib. Labels de valeur aux points, axes mois.
export function AdActivityChart({
  data,
}: {
  data: { key: string; label: string; value: number }[];
}) {
  const W = 720;
  const H = 200;
  const padL = 10;
  const padR = 10;
  const padTop = 26;
  const padBottom = 28;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const plotH = H - padTop - padBottom;
  const innerW = W - padL - padR;
  const stepX = n > 1 ? innerW / (n - 1) : 0;

  const pts = data.map((d, i) => {
    const x = padL + stepX * i;
    const y = H - padBottom - (d.value / max) * plotH;
    return { ...d, x, y };
  });

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${(padL + innerW).toFixed(1)},${H - padBottom} L${padL},${H - padBottom} Z`;
  // On ne labellise que quelques points (premier, dernier, pics) pour rester lisible.
  const peak = pts.reduce((m, p) => (p.value > m.value ? p : m), pts[0]);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[200px] w-full min-w-[560px]"
        role="img"
        aria-label="Nombre de pubs lancées par mois"
      >
        <defs>
          <linearGradient id="adAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Lignes de repère horizontales */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padL}
            y1={H - padBottom - t * plotH}
            x2={padL + innerW}
            y2={H - padBottom - t * plotH}
            style={{ stroke: "var(--color-border)" }}
            strokeWidth={1}
            strokeDasharray="3 5"
            opacity={0.6}
          />
        ))}
        <line
          x1={padL}
          y1={H - padBottom}
          x2={padL + innerW}
          y2={H - padBottom}
          style={{ stroke: "var(--color-border)" }}
          strokeWidth={1}
        />

        {/* Aire + courbe */}
        <path d={area} fill="url(#adAreaFill)" />
        <path
          d={line}
          fill="none"
          style={{ stroke: "var(--color-primary)" }}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points + labels */}
        {pts.map((p) => {
          const showLabel = p.value > 0 && (p === peak || p === pts[pts.length - 1]);
          return (
            <g key={p.key}>
              <title>{`${p.label} : ${p.value} pub${p.value > 1 ? "s" : ""}`}</title>
              <circle cx={p.x} cy={p.y} r={3.5} style={{ fill: "var(--color-surface)", stroke: "var(--color-primary)" }} strokeWidth={2} />
              {showLabel && (
                <text
                  x={p.x}
                  y={p.y - 9}
                  textAnchor="middle"
                  style={{ fill: "var(--color-primary)" }}
                  fontSize={11}
                  fontWeight={700}
                >
                  {p.value}
                </text>
              )}
              <text
                x={p.x}
                y={H - padBottom + 16}
                textAnchor="middle"
                style={{ fill: "var(--color-muted-foreground)" }}
                fontSize={10}
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
