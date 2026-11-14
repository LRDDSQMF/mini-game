import { soundEngine } from './audio';
import { renderGameFrame } from './renderer';
import {
  CAKE_HEIGHT,
  FLAVORS,
  INITIAL_CAKE_WIDTH,
  PERFECT_TOLERANCE,
  getStageForLayerCount,
} from './stages';
import {
  CakeLayer,
  CloudProp,
  DebrisPiece,
  FlavorConfig,
  FloatingCallout,
  FloatingStrawberryProp,
  GameState,
  HudSnapshot,
  ImpactRing,
  Particle,
  SavedRecords,
  SkyFlyerProp,
  StageDecoration,
  SwingingCake,
} from './types';

const RECORDS_STORAGE_KEY = 'sweet_stack_records_v1';
const GRAVITY = 2350;

export function loadSavedRecords(): SavedRecords {
  try {
    const raw = localStorage.getItem(RECORDS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedRecords>;
      return {
        bestLayers: typeof parsed.bestLayers === 'number' ? parsed.bestLayers : 0,
        bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
        unlockedDecorations: Array.isArray(parsed.unlockedDecorations)
          ? (parsed.unlockedDecorations as StageDecoration[])
          : [],
      };
    }
  } catch {
    // Ignore storage parse error
  }
  return { bestLayers: 0, bestScore: 0, unlockedDecorations: [] };
}

function saveRecords(records: SavedRecords): void {
  try {
    localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage write error
  }
}

export interface EngineCallbacks {
  onStateChange: (state: GameState) => void;
  onHudUpdate: (hud: HudSnapshot) => void;
}

export class CakeGameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;

  private rafId: number | null = null;
  private lastTimestamp: number = 0;
  private elapsed: number = 0;

  private width: number = 400;
  private height: number = 700;
  private dpr: number = 1;

  private gameState: GameState = 'TITLE_MENU';

  // World & Camera
  private groundScreenY: number = 560;
  private cameraY: number = 0;
  private targetCameraY: number = 0;

  // Feedback (hitstop & camera shake)
  private hitstopTimer: number = 0;
  private shakeTimer: number = 0;
  private shakeIntensity: number = 0;
  private recoilOffset: number = 0;

  // Entities
  private layers: CakeLayer[] = [];
  private swingingCake: SwingingCake | null = null;
  private debris: DebrisPiece[] = [];
  private particles: Particle[] = [];
  private rings: ImpactRing[] = [];
  private callouts: FloatingCallout[] = [];
  private clouds: CloudProp[] = [];
  private flyers: SkyFlyerProp[] = [];
  private floatingStrawberries: FloatingStrawberryProp[] = [];

  // Pendulum geometry
  private pivotX: number = 200;
  private pivotY: number = 24;
  private ropeLength: number = 135;
  private nextLayerTimer: number = 0;
  private gameOverDelayTimer: number = 0;

  // Scoring & Stage Progression
  private score: number = 0;
  private combo: number = 0;
  private maxCombo: number = 0;
  private perfectCount: number = 0;
  private currentCakeWidth: number = INITIAL_CAKE_WIDTH;
  private records: SavedRecords = loadSavedRecords();
  private isNewRecord: boolean = false;
  private stageClearBanner: HudSnapshot['stageClearBanner'] = null;
  private stageBannerTimer: number = 0;
  private layerIdCounter: number = 1;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.callbacks = callbacks;

    this.resize();
    this.initClouds();
    this.initFlyers();
    this.initFloatingStrawberries();
    this.setupTitlePreview();
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public resize(): void {
    const prevWidth = this.width;
    const parent = this.canvas.parentElement;
    const rect = parent ? parent.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(280, Math.floor(rect.width));
    this.height = Math.max(240, Math.floor(rect.height));

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.groundScreenY = Math.round(this.height * 0.8);
    this.pivotX = this.width / 2;
    this.pivotY = Math.max(14, Math.round(this.height * 0.052));
    this.ropeLength = Math.max(64, Math.min(165, Math.round(this.height * 0.19)));

    // Keep base layers centered if on title screen, or shift active world horizontally on resize
    if (this.gameState === 'TITLE_MENU') {
      this.setupTitlePreview();
    } else {
      const deltaX = (this.width - prevWidth) / 2;
      if (Math.abs(deltaX) > 0.01) {
        for (const layer of this.layers) layer.left += deltaX;
        if (this.swingingCake) this.swingingCake.x += deltaX;
        for (const d of this.debris) d.x += deltaX;
        for (const p of this.particles) p.x += deltaX;
        for (const r of this.rings) r.x += deltaX;
        for (const c of this.callouts) c.x += deltaX;
      }
      if (this.layers.length > 0) {
        this.recomputeCameraTarget();
      }
    }
  }

  private initClouds(): void {
    this.clouds = [];
    for (let i = 0; i < 34; i++) {
      const worldY = -170 - i * 185;
      const floorNumber = Math.round((i + 1) * 5);
      const isStrawberry = i % 2 === 1 || i % 5 === 0;
      this.clouds.push({
        xRatio: ((i * 0.37 + 0.12) % 0.8) + 0.1,
        worldY,
        scale: 0.72 + (i % 3) * 0.2,
        speed: (i % 2 === 0 ? 1 : -1) * (0.009 + (i % 4) * 0.003),
        variant: isStrawberry ? 'strawberry' : 'classic',
        altitudeLabel: i > 1 && i % 3 === 0 ? `${floorNumber}F` : undefined,
      });
    }
  }

  private initFlyers(): void {
    this.flyers = [
      // Lower & mid sky: Kuromi flying her airplane
      {
        kind: 'kuromi_plane',
        xRatio: 0.18,
        worldY: -365,
        speed: 0.068,
        scale: 0.92,
        bobPhase: 0.2,
      },
      {
        kind: 'kuromi_plane',
        xRatio: 0.82,
        worldY: -810,
        speed: -0.075,
        scale: 0.95,
        bobPhase: 1.9,
      },
      // Higher sky layers: Skye (PAW Patrol) flying her pink helicopter
      {
        kind: 'skye_heli',
        xRatio: 0.76,
        worldY: -1240,
        speed: -0.072,
        scale: 0.96,
        bobPhase: 0.7,
      },
      {
        kind: 'skye_heli',
        xRatio: 0.22,
        worldY: -1820,
        speed: 0.08,
        scale: 0.98,
        bobPhase: 2.4,
      },
      {
        kind: 'skye_heli',
        xRatio: 0.65,
        worldY: -2480,
        speed: -0.084,
        scale: 1.0,
        bobPhase: 1.1,
      },
      {
        kind: 'skye_heli',
        xRatio: 0.3,
        worldY: -3220,
        speed: 0.088,
        scale: 1.0,
        bobPhase: 3.1,
      },
    ];
  }

  private initFloatingStrawberries(): void {
    this.floatingStrawberries = [];
    const scalePresets = [0.42, 0.68, 0.96, 0.52, 1.24, 0.78, 0.48, 1.08];
    for (let i = 0; i < 56; i++) {
      const scale = scalePresets[i % scalePresets.length];
      const parallax = scale > 0.95 ? 0.9 : scale > 0.65 ? 0.8 : 0.7;
      this.floatingStrawberries.push({
        xRatio: ((i * 0.29 + 0.07) % 0.88) + 0.06,
        worldY: -115 - i * 112 - (i % 3) * 18,
        scale,
        driftSpeed: (i % 2 === 0 ? 1 : -1) * (0.006 + (i % 5) * 0.0025),
        bobPhase: i * 1.13,
        bobSpeed: 1.3 + (i % 4) * 0.35,
        bobAmp: 5 + scale * 6,
        tiltPhase: i * 0.87,
        baseTilt: ((i % 5) - 2) * 0.14,
        parallax,
        tintVariant: (i % 3) as 0 | 1 | 2,
      });
    }
  }

  private setupTitlePreview(): void {
    const cx = this.width / 2;
    this.layers = [
      {
        id: 1,
        left: cx - INITIAL_CAKE_WIDTH / 2,
        width: INITIAL_CAKE_WIDTH,
        height: CAKE_HEIGHT,
        y: 0,
        flavor: FLAVORS.strawberry,
        icingSeed: 12,
        squash: 1,
        squashVel: 0,
      },
      {
        id: 2,
        left: cx - (INITIAL_CAKE_WIDTH - 14) / 2,
        width: INITIAL_CAKE_WIDTH - 14,
        height: CAKE_HEIGHT,
        y: -CAKE_HEIGHT,
        flavor: FLAVORS.lemon,
        icingSeed: 27,
        squash: 1,
        squashVel: 0,
      },
      {
        id: 3,
        left: cx - (INITIAL_CAKE_WIDTH - 30) / 2,
        width: INITIAL_CAKE_WIDTH - 30,
        height: CAKE_HEIGHT,
        y: -CAKE_HEIGHT * 2,
        flavor: FLAVORS.matcha,
        icingSeed: 44,
        squash: 1,
        squashVel: 0,
        decoration: 'cherry',
      },
    ];
    this.debris = [];
    this.particles = [];
    this.rings = [];
    this.callouts = [];
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.swingingCake = null;
    this.emitHud();
  }

  public startNewGame(): void {
    soundEngine.unlock();
    soundEngine.startBgm();
    soundEngine.setBgmStageTempo(1);
    soundEngine.setBgmMode('playing');
    soundEngine.playClick();

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.currentCakeWidth = INITIAL_CAKE_WIDTH;
    this.isNewRecord = false;
    this.stageClearBanner = null;
    this.stageBannerTimer = 0;
    this.hitstopTimer = 0;
    this.shakeTimer = 0;
    this.gameOverDelayTimer = 0;
    this.nextLayerTimer = 0;
    this.recoilOffset = 0;
    this.cameraY = 0;
    this.targetCameraY = 0;

    this.layers = [];
    this.debris = [];
    this.particles = [];
    this.rings = [];
    this.callouts = [];

    this.spawnNextSwingingCake();
    this.setGameState('PLAYING');
    this.emitHud();
  }

  public returnToTitle(): void {
    soundEngine.playClick();
    soundEngine.setBgmStageTempo(1);
    soundEngine.setBgmMode('title');
    this.setGameState('TITLE_MENU');
    this.setupTitlePreview();
  }

  public pauseGame(): void {
    if (this.gameState !== 'PLAYING' || this.gameOverDelayTimer > 0) return;
    soundEngine.playClick();
    soundEngine.setBgmMode('paused');
    this.setGameState('PAUSED');
  }

  public resumeGame(): void {
    if (this.gameState !== 'PAUSED') return;
    soundEngine.unlock();
    soundEngine.startBgm();
    soundEngine.setBgmMode('playing');
    soundEngine.playClick();
    this.lastTimestamp = performance.now();
    this.setGameState('PLAYING');
  }

  public handlePrimaryAction(): void {
    if (this.gameState !== 'PLAYING') return;
    if (!this.swingingCake || this.swingingCake.state !== 'SWINGING') return;
    if (this.gameOverDelayTimer > 0) return;

    soundEngine.unlock();
    soundEngine.playDrop();
    this.swingingCake.state = 'FALLING';
    this.swingingCake.vy = 160;
    this.recoilOffset = 34;
  }

  private setGameState(next: GameState): void {
    this.gameState = next;
    this.callbacks.onStateChange(next);
  }

  private pickFlavorForCurrentStage(): FlavorConfig {
    const { stage } = getStageForLayerCount(this.layers.length);
    const id = stage.flavors[this.layers.length % stage.flavors.length];
    return FLAVORS[id];
  }

  private getEffectiveMaxAngle(stageMaxAngle: number): number {
    const safeHalfSpan = Math.max(40, this.width * 0.47 - this.currentCakeWidth * 0.38);
    const ratio = Math.min(0.95, safeHalfSpan / Math.max(60, this.ropeLength));
    return Math.min(stageMaxAngle, Math.asin(ratio));
  }

  private spawnNextSwingingCake(): void {
    const { stage } = getStageForLayerCount(this.layers.length);
    const flavor = this.pickFlavorForCurrentStage();

    // Start at left or right side alternating for crisp rhythm
    const startPhase = this.layers.length % 2 === 0 ? -Math.PI * 0.42 : Math.PI * 0.42;
    const maxAngle = this.getEffectiveMaxAngle(stage.maxAngle);
    const angle = maxAngle * Math.sin(startPhase);
    const screenX = this.pivotX + Math.sin(angle) * this.ropeLength;
    const screenCakeTopY = this.pivotY + Math.cos(angle) * this.ropeLength;
    const worldCakeBottomY = screenCakeTopY - this.groundScreenY + this.cameraY + CAKE_HEIGHT;

    this.swingingCake = {
      width: this.currentCakeWidth,
      height: CAKE_HEIGHT,
      flavor,
      icingSeed: this.layerIdCounter * 17 + 5,
      phase: startPhase,
      angle,
      x: screenX,
      y: worldCakeBottomY,
      vy: 0,
      tilt: 0,
      state: 'SWINGING',
    };
    this.layerIdCounter += 1;
  }

  private recomputeCameraTarget(): void {
    if (this.layers.length === 0) {
      this.targetCameraY = 0;
      return;
    }
    const topY = this.layers[this.layers.length - 1].y - CAKE_HEIGHT;
    // Keep the top of the cake tower comfortably around 60% down the viewport
    const desiredTopScreenY = this.height * 0.6;
    const idealCamY = this.groundScreenY + topY - desiredTopScreenY;
    this.targetCameraY = Math.min(0, idealCamY);
  }

  private update(dt: number): void {
    this.elapsed += dt;

    // Clouds, floating strawberries & sky flyers cruise smoothly in all non-paused states
    if (this.gameState !== 'PAUSED') {
      for (const cloud of this.clouds) {
        cloud.xRatio += cloud.speed * dt;
        if (cloud.xRatio > 1.18) cloud.xRatio = -0.18;
        if (cloud.xRatio < -0.18) cloud.xRatio = 1.18;
        if (this.groundScreenY + cloud.worldY - this.cameraY * 0.85 > this.height + 240) {
          cloud.worldY -= 34 * 185;
        }
      }
      for (const berry of this.floatingStrawberries) {
        berry.xRatio += berry.driftSpeed * dt;
        if (berry.xRatio > 1.12) berry.xRatio = -0.12;
        if (berry.xRatio < -0.12) berry.xRatio = 1.12;
        if (this.groundScreenY + berry.worldY - this.cameraY * berry.parallax > this.height + 200) {
          berry.worldY -= 56 * 112;
        }
      }
      for (const flyer of this.flyers) {
        flyer.xRatio += flyer.speed * dt;
        flyer.bobPhase += dt * 2.4;
        if (flyer.speed > 0 && flyer.xRatio > 1.2) flyer.xRatio = -0.2;
        if (flyer.speed < 0 && flyer.xRatio < -0.2) flyer.xRatio = 1.2;
        if (
          flyer.kind === 'skye_heli' &&
          this.groundScreenY + flyer.worldY - this.cameraY * 0.88 > this.height + 260
        ) {
          flyer.worldY -= 2600;
        }
      }
    }

    if (this.gameState === 'PAUSED') return;

    // Hitstop freeze frame for heavy impact feel
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    if (this.stageBannerTimer > 0) {
      this.stageBannerTimer -= dt;
      if (this.stageBannerTimer <= 0) {
        this.stageClearBanner = null;
        this.emitHud();
      }
    }

    // Smooth camera elevation follow
    this.cameraY += (this.targetCameraY - this.cameraY) * Math.min(1, dt * 6.5);

    // Recoil spring for ribbon clasp
    if (this.recoilOffset > 0) {
      this.recoilOffset = Math.max(0, this.recoilOffset - dt * 150);
    }

    // Layer landing squash-and-stretch spring recovery
    for (const layer of this.layers) {
      if (Math.abs(layer.squash - 1) > 0.001 || Math.abs(layer.squashVel) > 0.001) {
        const force = (1 - layer.squash) * 190;
        layer.squashVel = (layer.squashVel + force * dt) * Math.exp(-10 * dt);
        layer.squash += layer.squashVel * dt;
      } else {
        layer.squash = 1;
        layer.squashVel = 0;
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      p.angle += p.angularVel * dt;
    }

    // Update expanding rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.life -= dt;
      if (ring.life <= 0) {
        this.rings.splice(i, 1);
      }
    }

    // Update floating callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life -= dt;
      if (c.life <= 0) {
        this.callouts.splice(i, 1);
        continue;
      }
      c.y += c.vy * dt;
    }

    // Update falling trimmed/missed debris
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += GRAVITY * 0.9 * dt;
      d.angle += d.angularVel * dt;
      if (this.groundScreenY + d.y - this.cameraY > this.height + 240) {
        this.debris.splice(i, 1);
      }
    }

    if (this.gameState !== 'PLAYING') return;

    // Pending Game Over delay after a missed cake tumbles
    if (this.gameOverDelayTimer > 0) {
      this.gameOverDelayTimer -= dt;
      if (this.gameOverDelayTimer <= 0) {
        this.finishGame();
      }
      return;
    }

    // Brief cooldown before next swinging cake appears
    if (!this.swingingCake && this.nextLayerTimer > 0) {
      this.nextLayerTimer -= dt;
      if (this.nextLayerTimer <= 0) {
        this.spawnNextSwingingCake();
      }
      return;
    }

    if (!this.swingingCake) return;

    const cake = this.swingingCake;
    if (cake.state === 'SWINGING') {
      const { stage } = getStageForLayerCount(this.layers.length);
      const maxAngle = this.getEffectiveMaxAngle(stage.maxAngle);
      cake.phase += stage.swingSpeed * dt;
      cake.angle = maxAngle * Math.sin(cake.phase);
      cake.x = this.pivotX + Math.sin(cake.angle) * this.ropeLength;
      const screenCakeTopY = this.pivotY + Math.cos(cake.angle) * this.ropeLength;
      cake.y = screenCakeTopY - this.groundScreenY + this.cameraY + cake.height;
      cake.tilt = 0;
    } else {
      // Free-fall straight down onto tower
      cake.tilt = 0;
      cake.vy += GRAVITY * dt;
      cake.y += cake.vy * dt;

      const targetBottomY =
        this.layers.length === 0 ? 0 : this.layers[this.layers.length - 1].y - CAKE_HEIGHT;

      if (cake.y >= targetBottomY) {
        cake.y = targetBottomY;
        this.resolveLanding(cake);
      }
    }
  }

  private resolveLanding(cake: SwingingCake): void {
    const newLeft = cake.x - cake.width / 2;
    const newRight = cake.x + cake.width / 2;
    const minPlayableOverlap = 4;

    // First cake lands directly onto the ceramic cake stand (generous base)
    if (this.layers.length === 0) {
      const standLeft = this.width / 2 - 112;
      const standRight = this.width / 2 + 112;
      const overlapLeft = Math.max(newLeft, standLeft);
      const overlapRight = Math.min(newRight, standRight);
      const overlapWidth = overlapRight - overlapLeft;

      if (overlapWidth < minPlayableOverlap) {
        this.handleMiss(cake, newLeft < standLeft ? -1 : 1);
        return;
      }

      const centerDiff = Math.abs(cake.x - this.width / 2);
      const isPerfect = centerDiff <= PERFECT_TOLERANCE * 1.5;
      const placedLeft = isPerfect ? this.width / 2 - cake.width / 2 : overlapLeft;
      const placedWidth = isPerfect ? cake.width : overlapWidth;

      if (!isPerfect) {
        if (newLeft < standLeft) {
          const cutWidth = standLeft - newLeft;
          this.spawnDebris(newLeft + cutWidth / 2, cake.y - CAKE_HEIGHT / 2, cutWidth, cake, -1);
        }
        if (newRight > standRight) {
          const cutWidth = newRight - standRight;
          this.spawnDebris(standRight + cutWidth / 2, cake.y - CAKE_HEIGHT / 2, cutWidth, cake, 1);
        }
      }

      this.commitLandedLayer(placedLeft, placedWidth, 0, cake, isPerfect, !isPerfect && overlapWidth < cake.width);
      return;
    }

    const topLayer = this.layers[this.layers.length - 1];
    const targetLeft = topLayer.left;
    const targetRight = topLayer.left + topLayer.width;
    const targetCenter = targetLeft + topLayer.width / 2;

    const overlapLeft = Math.max(newLeft, targetLeft);
    const overlapRight = Math.min(newRight, targetRight);
    const overlapWidth = overlapRight - overlapLeft;

    // Completely missed or grazed too thinly (< 4px)
    if (overlapWidth < minPlayableOverlap) {
      const missDir = cake.x < targetCenter ? -1 : 1;
      this.handleMiss(cake, missDir);
      return;
    }

    const isBonusWiderCake = cake.width > topLayer.width + 0.5;
    const centerDiff = Math.abs(cake.x - targetCenter);
    const tolerance = isBonusWiderCake ? PERFECT_TOLERANCE * 1.35 : PERFECT_TOLERANCE;
    const isPerfect = centerDiff <= tolerance;

    if (isPerfect) {
      // Snap cleanly centered on the top layer; preserve bonus width if wider!
      const placedWidth = isBonusWiderCake ? cake.width : topLayer.width;
      const placedLeft = targetCenter - placedWidth / 2;
      this.commitLandedLayer(placedLeft, placedWidth, topLayer.y - CAKE_HEIGHT, cake, true, false);
    } else if (isBonusWiderCake) {
      // Wider celebration cake: allow symmetric bonus overhang around topLayer, slice only excess
      const maxOverhang = (cake.width - topLayer.width) / 2;
      const supportLeft = targetLeft - maxOverhang;
      const supportRight = targetRight + maxOverhang;
      const placedLeft = Math.max(newLeft, supportLeft);
      const placedRight = Math.min(newRight, supportRight);
      const placedWidth = placedRight - placedLeft;

      if (newLeft < placedLeft) {
        const cutWidth = placedLeft - newLeft;
        this.spawnDebris(newLeft + cutWidth / 2, cake.y - CAKE_HEIGHT / 2, cutWidth, cake, -1);
      }
      if (newRight > placedRight) {
        const cutWidth = newRight - placedRight;
        this.spawnDebris(placedRight + cutWidth / 2, cake.y - CAKE_HEIGHT / 2, cutWidth, cake, 1);
      }

      this.commitLandedLayer(
        placedLeft,
        placedWidth,
        topLayer.y - CAKE_HEIGHT,
        cake,
        false,
        placedWidth < cake.width - 0.5
      );
    } else {
      // Standard cake: slice overhanging part off as tumbling debris
      if (newLeft < targetLeft) {
        const cutWidth = targetLeft - newLeft;
        this.spawnDebris(newLeft + cutWidth / 2, cake.y - CAKE_HEIGHT / 2, cutWidth, cake, -1);
      }
      if (newRight > targetRight) {
        const cutWidth = newRight - targetRight;
        this.spawnDebris(targetRight + cutWidth / 2, cake.y - CAKE_HEIGHT / 2, cutWidth, cake, 1);
      }

      this.commitLandedLayer(overlapLeft, overlapWidth, topLayer.y - CAKE_HEIGHT, cake, false, true);
    }
  }

  private commitLandedLayer(
    left: number,
    width: number,
    bottomY: number,
    cake: SwingingCake,
    isPerfect: boolean,
    wasSliced: boolean
  ): void {
    const newLayerCount = this.layers.length + 1;
    const { stage: stageBefore } = getStageForLayerCount(this.layers.length);
    const reachedMilestone = newLayerCount === stageBefore.targetLayers;

    const layer: CakeLayer = {
      id: this.layerIdCounter,
      left,
      width,
      height: CAKE_HEIGHT,
      y: bottomY,
      flavor: cake.flavor,
      icingSeed: cake.icingSeed,
      squash: isPerfect ? 1.15 : 1.11,
      squashVel: 0,
      decoration: reachedMilestone ? stageBefore.decoration : undefined,
      isMilestone: reachedMilestone,
    };

    this.layers.push(layer);
    this.swingingCake = null;
    this.currentCakeWidth = width;
    this.recomputeCameraTarget();

    const centerX = left + width / 2;

    if (isPerfect) {
      this.combo += 1;
      this.perfectCount += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      const bonus = 15 + this.combo * 5;
      this.score += bonus;

      soundEngine.playLand(true, this.combo);
      this.rings.push({
        x: centerX,
        y: bottomY - CAKE_HEIGHT / 2,
        radius: width * 0.35,
        maxRadius: width * 0.9,
        color: '#FFB703',
        life: 0.42,
        maxLife: 0.42,
      });
      this.spawnParticles(centerX, bottomY - CAKE_HEIGHT, 14, 'star', ['#FFB703', '#FF4D6D', '#FFFDF9']);
      this.callouts.push({
        x: centerX,
        y: bottomY - CAKE_HEIGHT - 18,
        vy: -54,
        text: this.combo >= 2 ? `完美 ×${this.combo}` : '完美對齊!',
        subtext: `+${bonus}`,
        color: '#FFB703',
        life: 0.85,
        maxLife: 0.85,
      });
      this.triggerShake(2.2, 0.12);
    } else {
      this.combo = 0;
      this.score += 10;
      soundEngine.playLand(false, 0);
      if (wasSliced) {
        soundEngine.playSlice();
        this.hitstopTimer = 0.032;
        this.triggerShake(4.2, 0.16);
        this.spawnParticles(centerX, bottomY - CAKE_HEIGHT / 2, 8, 'crumb', [
          cake.flavor.sponge,
          cake.flavor.icing,
        ]);
      } else {
        this.triggerShake(2.0, 0.1);
      }
    }

    // Stage Milestone Reward
    if (reachedMilestone) {
      soundEngine.playStageClear();
      soundEngine.setBgmStageTempo(stageBefore.stageNumber + 1);
      this.score += 50;
      this.currentCakeWidth = Math.min(INITIAL_CAKE_WIDTH, width + stageBefore.widthBonus);
      this.spawnParticles(centerX, bottomY - CAKE_HEIGHT - 10, 32, 'confetti', [
        '#FF4D6D',
        '#FFB703',
        '#A8E6CF',
        '#A2D2FF',
        '#FF9EBB',
      ]);

      this.stageClearBanner = {
        stageName: stageBefore.name,
        decorationName: stageBefore.decorationName,
        widthBonus: Math.round(this.currentCakeWidth - width),
      };
      this.stageBannerTimer = 2.6;

      if (!this.records.unlockedDecorations.includes(stageBefore.decoration)) {
        this.records.unlockedDecorations.push(stageBefore.decoration);
        saveRecords(this.records);
      }
    }

    // Update live best record indicator
    if (newLayerCount > this.records.bestLayers || this.score > this.records.bestScore) {
      this.isNewRecord = true;
    }

    this.nextLayerTimer = 0.11;
    this.emitHud();
  }

  private spawnDebris(
    centerX: number,
    centerY: number,
    cutWidth: number,
    cake: SwingingCake,
    dir: -1 | 1
  ): void {
    if (cutWidth < 1.5) return;
    this.debris.push({
      x: centerX,
      y: centerY,
      width: cutWidth,
      height: CAKE_HEIGHT,
      vx: dir * (70 + Math.random() * 55),
      vy: -90,
      angle: 0,
      angularVel: dir * (2.6 + Math.random() * 2.2),
      flavor: cake.flavor,
      icingSeed: cake.icingSeed + 3,
      alpha: 1,
    });
  }

  private handleMiss(cake: SwingingCake, dir: -1 | 1): void {
    soundEngine.playGameOver();
    this.combo = 0;
    this.swingingCake = null;
    this.triggerShake(7.5, 0.28);

    this.debris.push({
      x: cake.x,
      y: cake.y - CAKE_HEIGHT / 2,
      width: cake.width,
      height: CAKE_HEIGHT,
      vx: dir * 95,
      vy: -40,
      angle: 0,
      angularVel: dir * 3.4,
      flavor: cake.flavor,
      icingSeed: cake.icingSeed,
      alpha: 1,
    });

    this.callouts.push({
      x: cake.x,
      y: cake.y - CAKE_HEIGHT - 16,
      vy: -35,
      text: '掉下去啦!',
      color: '#FF4D6D',
      life: 0.75,
      maxLife: 0.75,
    });

    this.gameOverDelayTimer = 0.48;
    this.emitHud();
  }

  private finishGame(): void {
    const layersCount = this.layers.length;
    if (layersCount > this.records.bestLayers) {
      this.records.bestLayers = layersCount;
      this.isNewRecord = true;
    }
    if (this.score > this.records.bestScore) {
      this.records.bestScore = this.score;
      this.isNewRecord = true;
    }
    saveRecords(this.records);
    soundEngine.setBgmMode('gameover');
    this.setGameState('GAME_OVER');
    this.emitHud();
  }

  private triggerShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  private spawnParticles(
    x: number,
    y: number,
    count: number,
    shape: Particle['shape'],
    colors: string[]
  ): void {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI + Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 210;
      const life = 0.55 + Math.random() * 0.45;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 90,
        size: shape === 'confetti' ? 5 + Math.random() * 4 : 4 + Math.random() * 4,
        color: colors[i % colors.length],
        shape,
        angle: Math.random() * Math.PI * 2,
        angularVel: (Math.random() - 0.5) * 9,
        life,
        maxLife: life,
      });
    }
  }

  private emitHud(): void {
    const layersCount = this.layers.length;
    const { stage, startLayer } = getStageForLayerCount(layersCount);
    this.callbacks.onHudUpdate({
      score: this.score,
      layers: layersCount,
      combo: this.combo,
      maxCombo: this.maxCombo,
      perfectCount: this.perfectCount,
      stageNumber: stage.stageNumber,
      stageName: stage.name,
      stageStartLayer: startLayer,
      stageTargetLayer: stage.targetLayers,
      bestLayers: Math.max(this.records.bestLayers, layersCount),
      bestScore: Math.max(this.records.bestScore, this.score),
      isNewRecord: this.isNewRecord,
      stageClearBanner: this.stageClearBanner,
    });
  }

  private render(): void {
    const shakeScale = this.shakeTimer > 0 ? this.shakeTimer / 0.28 : 0;
    const shakeX = (Math.random() - 0.5) * 2 * this.shakeIntensity * shakeScale;
    const shakeY = (Math.random() - 0.5) * 2 * this.shakeIntensity * shakeScale;

    renderGameFrame({
      ctx: this.ctx,
      width: this.width,
      height: this.height,
      cameraY: this.cameraY,
      groundScreenY: this.groundScreenY,
      shakeX,
      shakeY,
      time: this.elapsed,
      clouds: this.clouds,
      floatingStrawberries: this.floatingStrawberries,
      flyers: this.flyers,
      layers: this.layers,
      swingingCake: this.swingingCake,
      pivotX: this.pivotX,
      pivotY: this.pivotY,
      ropeLength: this.ropeLength,
      debris: this.debris,
      particles: this.particles,
      rings: this.rings,
      callouts: this.callouts,
      showPendulum: this.gameState === 'PLAYING' || this.gameState === 'PAUSED',
      recoilOffset: this.recoilOffset,
    });
  }
}
