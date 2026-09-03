/** Internal, used only by EmptyState and the shell's TopBar. The festival's orange burst glyph. */
export interface BurstProps {
  size?: number;
  className?: string;
}

const RAY_COUNT = 16;

export function Burst({ size = 28, className }: BurstProps) {
  const rays = Array.from({ length: RAY_COUNT }, (_, i) => (360 / RAY_COUNT) * i);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="#ff6600">
        {rays.map((deg) => (
          <polygon key={deg} points="50,2 56,30 44,30" transform={`rotate(${deg} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="22" />
      </g>
    </svg>
  );
}
