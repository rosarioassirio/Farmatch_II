export function FarmyIcon({ size = 32 }: { size?: number }) {
    const INK = '#1e3a5f';
    const BLUE = '#3b82f6';
    const BLUE2 = '#2f6fe0';
    return (
        <svg viewBox="0 0 200 250" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size * 1.25}>
            <ellipse cx="100" cy="238" rx="46" ry="8" fill={INK} opacity=".08" />
            {/* feet */}
            <ellipse cx="84" cy="222" rx="13" ry="9" fill={INK} />
            <ellipse cx="116" cy="222" rx="13" ry="9" fill={INK} />
            {/* arms */}
            <path d="M56 152 q-26 8 -30 36" stroke={BLUE2} strokeWidth="13" fill="none" strokeLinecap="round" />
            <circle cx="26" cy="188" r="9" fill={BLUE2} />
            <path d="M144 128 q28 -8 36 -30" stroke={BLUE2} strokeWidth="13" fill="none" strokeLinecap="round" />
            <circle cx="180" cy="96" r="9" fill={BLUE2} />
            {/* body capsule */}
            <rect x="52" y="40" width="96" height="174" rx="48" fill="#fff" />
            <clipPath id="capA"><rect x="52" y="40" width="96" height="174" rx="48" /></clipPath>
            <g clipPath="url(#capA)">
                <rect x="52" y="40" width="96" height="87" fill={BLUE} />
                <rect x="52" y="123" width="96" height="7" fill="#dbe7fb" />
            </g>
            {/* pill score */}
            <rect x="72" y="170" width="56" height="5" rx="2.5" fill="#dbe7fb" />
            {/* face */}
            <circle cx="85" cy="82" r="9" fill="#fff" />
            <circle cx="115" cy="82" r="9" fill="#fff" />
            <circle cx="86" cy="84" r="4.2" fill={INK} />
            <circle cx="116" cy="84" r="4.2" fill={INK} />
            <circle cx="72" cy="98" r="6.5" fill="#fff" opacity=".22" />
            <circle cx="128" cy="98" r="6.5" fill="#fff" opacity=".22" />
            <path d="M88 99 q12 12 24 0" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" />
        </svg>
    );
}