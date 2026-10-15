const dots = [[8, 5], [15, 5], [22, 5], [5, 12], [12, 12], [19, 12], [11, 19], [18, 19], [25, 19], [8, 26], [15, 26], [22, 26]];

export function LogoMark({ className = "", size = 24 }: { className?: string; size?: number }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 30 30" fill="currentColor" aria-hidden="true" focusable="false">
    {dots.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.5" />)}
  </svg>;
}
