// Logo horizontal: isotipo + wordmark
export function FarmatchLogoHorizontal({ height = 48, onDark = false }: { height?: number; onDark?: boolean }) {
    const top = onDark ? '#9cc2fc' : '#7fb0fb';
    const bot = onDark ? '#ffffff' : '#1e3a5f';
    const seam = onDark ? '#1e3a5f' : '#ffffff';
    const mapF = onDark ? '#3a5e85' : '#d7e6fb';
    const st = onDark ? '#cfe0fb' : '#ffffff';
    const inkColor = onDark ? '#ffffff' : '#1e3a5f';
    const mColor = onDark ? '#7fb0fb' : '#3b82f6';
    const subColor = onDark ? '#9cc2fc' : '#6b7280';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, height }}>
            {/* Isotipo */}
            <svg width={height * 0.53} height={height} viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M30 121 L90 121 L105 149 L15 149 Z" fill={mapF} />
                <path d="M53 121 L46 149" stroke={st} strokeWidth="3" strokeLinecap="round" opacity=".95" />
                <path d="M73 121 L82 149" stroke={st} strokeWidth="3" strokeLinecap="round" opacity=".95" />
                <path d="M22 136 L98 136" stroke={st} strokeWidth="3" strokeLinecap="round" opacity=".95" />
                <defs>
                    <clipPath id="pinClip1">
                        <path d="M60 124 C46 99 18 81 18 50 A42 36 0 1 1 102 50 C102 81 74 99 60 124 Z" />
                    </clipPath>
                </defs>
                <g clipPath="url(#pinClip1)">
                    <rect x="0" y="0" width="120" height="50" fill={top} />
                    <rect x="0" y="50" width="120" height="120" fill={bot} />
                    <rect x="0" y="48.4" width="120" height="3.2" fill={seam} />
                </g>
            </svg>
            {/* Wordmark */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{
                    fontWeight: 800,
                    fontSize: height * 0.42,
                    letterSpacing: '-0.025em',
                    lineHeight: 1,
                    color: inkColor,
                    fontFamily: 'system-ui, sans-serif',
                }}>
                    FAR<span style={{ color: mColor }}>MATCH</span>
                </span>
                <span style={{
                    fontSize: height * 0.22,
                    fontWeight: 500,
                    color: subColor,
                    marginTop: 4,
                    letterSpacing: '0.005em',
                    fontFamily: 'system-ui, sans-serif',
                }}>
                    Tu farmacia, en el mapa.
                </span>
            </div>
        </div>
    );
}

// Solo isotipo (para favicon, avatar, etc)
export function FarmatchIsotipo({ size = 40, onDark = false }: { size?: number; onDark?: boolean }) {
    const top = onDark ? '#9cc2fc' : '#7fb0fb';
    const bot = onDark ? '#ffffff' : '#1e3a5f';
    const seam = onDark ? '#1e3a5f' : '#ffffff';
    const mapF = onDark ? '#3a5e85' : '#d7e6fb';
    const st = onDark ? '#cfe0fb' : '#ffffff';

    return (
        <svg width={size * 0.8} height={size} viewBox="0 0 120 150" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M30 121 L90 121 L105 149 L15 149 Z" fill={mapF} />
            <path d="M53 121 L46 149" stroke={st} strokeWidth="3" strokeLinecap="round" opacity=".95" />
            <path d="M73 121 L82 149" stroke={st} strokeWidth="3" strokeLinecap="round" opacity=".95" />
            <path d="M22 136 L98 136" stroke={st} strokeWidth="3" strokeLinecap="round" opacity=".95" />
            <defs>
                <clipPath id="pinClip2">
                    <path d="M60 124 C46 99 18 81 18 50 A42 36 0 1 1 102 50 C102 81 74 99 60 124 Z" />
                </clipPath>
            </defs>
            <g clipPath="url(#pinClip2)">
                <rect x="0" y="0" width="120" height="50" fill={top} />
                <rect x="0" y="50" width="120" height="120" fill={bot} />
                <rect x="0" y="48.4" width="120" height="3.2" fill={seam} />
            </g>
        </svg>
    );
}