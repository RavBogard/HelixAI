import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'HelixTones — AI-Powered Helix Preset Builder'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%)',
          padding: '80px',
        }}
      >
        {/* Brand */}
        <div
          style={{
            fontSize: 104,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-4px',
            fontFamily: 'sans-serif',
            lineHeight: 1,
            marginBottom: '20px',
          }}
        >
          helixtones
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 26,
            color: '#9ca3af',
            fontFamily: 'sans-serif',
            letterSpacing: '4px',
            textTransform: 'uppercase',
            marginBottom: '56px',
          }}
        >
          AI-Powered Helix Preset Builder
        </div>

        {/* Device chips */}
        <div style={{ display: 'flex', gap: '14px' }}>
          {['Helix LT', 'Helix Floor', 'Helix Stadium', 'Pod Go', 'HX Stomp'].map((device) => (
            <div
              key={device}
              style={{
                padding: '10px 22px',
                background: '#161616',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
                color: '#6b7280',
                fontSize: 17,
                fontFamily: 'monospace',
              }}
            >
              {device}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
