import { Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface TitleOverlayProps {
  hud: HudSnapshot;
  isMuted: boolean;
  onStart: () => void;
  onToggleMute: () => void;
}

export function TitleOverlay({ hud, isMuted, onStart, onToggleMute }: TitleOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col justify-between pointer-events-none px-5 pt-5 pb-7 sm:py-8"
      style={{ paddingBottom: 'max(1.75rem, env(safe-area-inset-bottom))' }}
    >
      {/* Top Bar: Quiet mute button only */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute();
          }}
          aria-label={isMuted ? '開啟音效' : '靜音'}
          className="pointer-events-auto min-h-[44px] min-w-[44px] flex items-center justify-center rounded-2xl bg-[#FFFDF9] border-2 border-b-4 border-[#5C3D2E] text-[#5C3D2E] active:translate-y-0.5 active:border-b-2 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF4D6D]"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Upper-Center Calm Negative Space: Bespoke SVG Title Lockup */}
      <div className="flex flex-col items-center text-center my-auto pb-28 sm:pb-36">
        <div className="animate-gentle-float w-full max-w-[340px] sm:max-w-[420px]">
          <svg
            viewBox="0 0 420 185"
            className="w-full h-auto drop-shadow-[0_4px_0_rgba(92,61,46,0.18)]"
            role="img"
            aria-label="Sweet Stack 甜點疊高高"
          >
            {/* Hand-drawn scalloped ribbon banner behind title */}
            <path
              d="M38 112 C38 96, 52 88, 72 88 L348 88 C368 88, 382 96, 382 112 L382 134 C382 150, 368 158, 348 158 L72 158 C52 158, 38 150, 38 134 Z"
              fill="#FFFDF9"
              stroke="#5C3D2E"
              strokeWidth="4"
            />
            {/* Decorative little strawberry icon at top center */}
            <g transform="translate(210, 38)">
              {/* Stem & leaves */}
              <path
                d="M-12 -14 Q0 -22 12 -14 Q4 -10 0 -18 Q-4 -10 -12 -14 Z"
                fill="#74C69D"
                stroke="#5C3D2E"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* Berry body */}
              <path
                d="M0 -13 C16 -13 20 2 10 15 C5 22 -5 22 -10 15 C-20 2 -16 -13 0 -13 Z"
                fill="#FF4D6D"
                stroke="#5C3D2E"
                strokeWidth="3.2"
              />
              {/* Seeds */}
              <circle cx="-5" cy="-2" r="1.5" fill="#FFE082" />
              <circle cx="5" cy="-1" r="1.5" fill="#FFE082" />
              <circle cx="0" cy="7" r="1.5" fill="#FFE082" />
            </g>

            {/* English Display Lockup */}
            <text
              x="210"
              y="80"
              textAnchor="middle"
              fill="#FF4D6D"
              stroke="#5C3D2E"
              strokeWidth="6"
              paintOrder="stroke"
              style={{
                fontFamily: 'Fredoka, sans-serif',
                fontWeight: 700,
                fontSize: '42px',
                letterSpacing: '0.02em',
              }}
            >
              SWEET STACK
            </text>

            {/* Chinese Subtitle Lockup */}
            <text
              x="210"
              y="133"
              textAnchor="middle"
              fill="#5C3D2E"
              style={{
                fontFamily: '"Noto Sans TC", sans-serif',
                fontWeight: 900,
                fontSize: '28px',
                letterSpacing: '0.12em',
              }}
            >
              甜點疊高高
            </text>
          </svg>
        </div>

        {/* Clean Unboxed Metadata (Zero Pills) */}
        <p className="mt-2 text-sm sm:text-base font-bold text-[#5C3D2E]/85 tracking-wide tabular-nums">
          {hud.bestLayers > 0 ? (
            <>
              最高紀錄 {hud.bestLayers} 層 <span aria-hidden="true">·</span> {hud.bestScore.toLocaleString()} 分
            </>
          ) : (
            '掌握鐘擺節奏，層層疊出夢想蛋糕塔'
          )}
        </p>

        {/* Primary Start CTA */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          className="pointer-events-auto mt-6 min-h-[52px] px-10 py-3 rounded-2xl bg-[#FF4D6D] hover:bg-[#F53B5C] text-[#FFFDF9] font-display text-xl font-bold tracking-wider border-2 border-b-[6px] border-[#5C3D2E] active:translate-y-1 active:border-b-2 transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5C3D2E]"
        >
          開始烘焙
        </button>
      </div>

      {/* Single Flat Control-Hint Line */}
      <div className="text-center">
        <p className="text-xs sm:text-sm font-bold text-[#5C3D2E]/80 bg-[#FFFDF9]/75 inline-block px-4 py-1.5 rounded-xl">
          點擊螢幕或按空白鍵放下蛋糕 · P 暫停
        </p>
      </div>
    </div>
  );
}
