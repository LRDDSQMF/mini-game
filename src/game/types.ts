export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type FlavorId =
  | 'strawberry'
  | 'lemon'
  | 'matcha'
  | 'blueberry'
  | 'cocoa'
  | 'caramel';

export type StageDecoration =
  | 'cherry'
  | 'macaron'
  | 'candle'
  | 'crown'
  | 'pennant';

export interface FlavorConfig {
  id: FlavorId;
  name: string;
  sponge: string;
  spongeShadow: string;
  filling: string;
  icing: string;
  icingHighlight: string;
  sprinkles: string[];
}

export interface StageConfig {
  stageNumber: number;
  name: string;
  targetLayers: number;
  swingSpeed: number;
  maxAngle: number;
  widthBonus: number;
  decoration: StageDecoration;
  decorationName: string;
  flavors: FlavorId[];
}

export interface CakeLayer {
  id: number;
  left: number;
  width: number;
  height: number;
  y: number; // Bottom Y in world coordinates (0 = pedestal top, negative goes UP)
  flavor: FlavorConfig;
  icingSeed: number;
  squash: number; // 1 = normal, >1 = squashed horizontally / shorter vertically on impact
  squashVel: number;
  decoration?: StageDecoration;
  isMilestone?: boolean;
}

export interface SwingingCake {
  width: number;
  height: number;
  flavor: FlavorConfig;
  icingSeed: number;
  phase: number;
  angle: number;
  x: number; // Center X in world coordinates
  y: number; // Bottom Y in world coordinates
  vy: number;
  tilt: number;
  state: 'SWINGING' | 'FALLING';
}

export interface DebrisPiece {
  x: number; // Center X
  y: number; // Center Y
  width: number;
  height: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  flavor: FlavorConfig;
  icingSeed: number;
  alpha: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: 'circle' | 'star' | 'confetti' | 'crumb';
  angle: number;
  angularVel: number;
  life: number;
  maxLife: number;
}

export interface ImpactRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  subtext?: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface CloudProp {
  xRatio: number;
  worldY: number;
  scale: number;
  speed: number;
  variant: 'classic' | 'strawberry';
  altitudeLabel?: string;
}

export interface SkyFlyerProp {
  kind: 'kuromi_plane' | 'skye_heli';
  xRatio: number;
  worldY: number;
  speed: number; // xRatio units per second (positive = flying right, negative = flying left)
  scale: number;
  bobPhase: number;
}

export interface FloatingStrawberryProp {
  xRatio: number;
  worldY: number;
  scale: number; // Small (0.45) to Large (1.3)
  driftSpeed: number;
  bobPhase: number;
  bobSpeed: number;
  bobAmp: number;
  tiltPhase: number;
  baseTilt: number;
  parallax: number;
  tintVariant: 0 | 1 | 2;
}

export interface HudSnapshot {
  score: number;
  layers: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  stageNumber: number;
  stageName: string;
  stageStartLayer: number;
  stageTargetLayer: number;
  bestLayers: number;
  bestScore: number;
  isNewRecord: boolean;
  stageClearBanner: {
    stageName: string;
    decorationName: string;
    widthBonus: number;
  } | null;
}

export interface SavedRecords {
  bestLayers: number;
  bestScore: number;
  unlockedDecorations: StageDecoration[];
}
