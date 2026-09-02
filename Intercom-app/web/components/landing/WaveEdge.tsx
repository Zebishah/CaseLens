type WaveEdgeProps = {
  fill?: string;
  invert?: boolean;
  className?: string;
};

export function WaveEdge({ fill = '#ffffff', invert = false, className = '' }: WaveEdgeProps) {
  return (
    <svg
      className={`wave-edge ${invert ? 'rotate-180' : ''} ${className}`}
      viewBox="0 0 1440 88"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        fill={fill}
        d="M0 48c160 32 280-36 440-28 180 9 250 62 430 52 150-8 250-54 370-48 80 4 140 22 200 40V88H0V48Z"
      />
    </svg>
  );
}
