export default function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"
         style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="sg-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b2230" />
          <stop offset="1" stopColor="#0d1117" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#sg-logo-bg)"
            stroke="#d50a0a" strokeWidth="2.5" />
      <rect x="14" y="38" width="8" height="13" rx="2.5" fill="#8b949e" />
      <rect x="28" y="31" width="8" height="20" rx="2.5" fill="#c9d1d9" />
      <rect x="42" y="22" width="8" height="29" rx="2.5" fill="#d50a0a" />
      <path d="M14 28 L28 22 L42 13" stroke="#fff" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
