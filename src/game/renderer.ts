import backdropUrl from '../assets/images/bakery_sky_backdrop_1794634998175.jpg';
import { OUTLINE_COLOR } from './stages';
import {
  CakeLayer,
  CloudProp,
  DebrisPiece,
  FlavorConfig,
  FloatingCallout,
  FloatingStrawberryProp,
  ImpactRing,
  Particle,
  SkyFlyerProp,
  StageDecoration,
  SwingingCake,
} from './types';

// Preload illustrated bakery backdrop
const backdropImage = new Image();
let backdropLoaded = false;
backdropImage.onload = () => {
  backdropLoaded = true;
};
backdropImage.src = backdropUrl;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(hexA: string, hexB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, clamped));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, clamped));
  const bl = Math.round(lerp(a & 255, b & 255, clamped));
  return `rgb(${r}, ${g}, ${bl})`;
}

// Deterministic pseudo-random helper for hand-drawn icing drips & sprinkles
function seededRand(seed: number, index: number): number {
  const x = Math.sin(seed * 91.345 + index * 47.123) * 43758.5453;
  return x - Math.floor(x);
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  cameraY: number; // Negative values mean camera has scrolled UP
  groundScreenY: number;
  shakeX: number;
  shakeY: number;
  time: number;
  clouds: CloudProp[];
  floatingStrawberries: FloatingStrawberryProp[];
  flyers: SkyFlyerProp[];
  layers: CakeLayer[];
  swingingCake: SwingingCake | null;
  pivotX: number;
  pivotY: number;
  ropeLength: number;
  debris: DebrisPiece[];
  particles: Particle[];
  rings: ImpactRing[];
  callouts: FloatingCallout[];
  showPendulum: boolean;
  recoilOffset: number;
}

export function renderGameFrame(rc: RenderContext): void {
  const { ctx, width, height, cameraY, groundScreenY, shakeX, shakeY, time } = rc;

  ctx.save();

  // 1. Sky Gradient based on altitude (-cameraY)
  const altitude = Math.max(0, -cameraY);
  const skyProgress = Math.min(1, altitude / 2400);

  let topColor: string;
  let bottomColor: string;
  if (skyProgress < 0.45) {
    const t = skyProgress / 0.45;
    topColor = lerpColor('#E3F4FF', '#FFD8E8', t);
    bottomColor = lerpColor('#FFF9F2', '#FFEBC6', t);
  } else if (skyProgress < 0.8) {
    const t = (skyProgress - 0.45) / 0.35;
    topColor = lerpColor('#FFD8E8', '#54467A', t);
    bottomColor = lerpColor('#FFEBC6', '#C892B8', t);
  } else {
    const t = (skyProgress - 0.8) / 0.2;
    topColor = lerpColor('#54467A', '#262047', t);
    bottomColor = lerpColor('#C892B8', '#5E4B7C', t);
  }

  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, topColor);
  skyGrad.addColorStop(1, bottomColor);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Twinkling hand-drawn stars at higher altitudes
  if (skyProgress > 0.42) {
    const starAlpha = Math.min(1, (skyProgress - 0.42) / 0.35);
    ctx.save();
    for (let i = 0; i < 28; i++) {
      const sx = seededRand(11, i) * width;
      const sy = ((seededRand(29, i) * height * 1.4 + cameraY * -0.15) % height + height) % height;
      const twinkle = 0.45 + 0.55 * Math.sin(time * 2.2 + i * 1.7);
      ctx.globalAlpha = starAlpha * twinkle * 0.85;
      ctx.fillStyle = i % 3 === 0 ? '#FFE082' : '#FFFDF9';
      drawFourPointStar(ctx, sx, sy, 3 + (i % 3) * 1.6);
    }
    ctx.restore();
  }

  // 3. Apply camera shake to world elements
  ctx.translate(shakeX, shakeY);

  // 4. Generated Bakery Key-Art Backdrop anchored near ground horizon
  const worldGroundY = groundScreenY - cameraY;
  if (backdropLoaded && backdropImage.naturalWidth > 0 && worldGroundY > -height * 0.4) {
    const aspect = backdropImage.width / backdropImage.height;
    const drawW = Math.max(width, height * aspect * 0.72);
    const drawH = drawW / aspect;
    const drawX = (width - drawW) / 2;
    // Align bottom of illustration slightly below ground table
    const drawY = worldGroundY - drawH + Math.min(120, drawH * 0.14);

    if (drawY < height) {
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.drawImage(backdropImage, drawX, drawY, drawW, drawH);
      // Soft top fade so illustration blends seamlessly into dynamic sky gradient
      const fadeGrad = ctx.createLinearGradient(0, drawY, 0, drawY + drawH * 0.32);
      fadeGrad.addColorStop(0, topColor);
      fadeGrad.addColorStop(1, 'rgba(255, 249, 242, 0)');
      ctx.fillStyle = fadeGrad;
      ctx.fillRect(0, drawY - 2, width, drawH * 0.32);
      ctx.restore();
    }
  }

  // 5. Parallax Clouds & Strawberry Clouds
  for (const cloud of rc.clouds) {
    const screenY = groundScreenY + cloud.worldY - cameraY * 0.85;
    if (screenY > -110 && screenY < height + 110) {
      drawHandDrawnCloud(
        ctx,
        cloud.xRatio * width,
        screenY,
        cloud.scale,
        skyProgress,
        cloud.variant,
        cloud.altitudeLabel
      );
    }
  }

  // 5a. Varied-Size Floating Strawberries in the Sky
  for (const berry of rc.floatingStrawberries) {
    const screenY =
      groundScreenY +
      berry.worldY -
      cameraY * berry.parallax +
      Math.sin(time * berry.bobSpeed + berry.bobPhase) * berry.bobAmp;
    if (screenY > -80 && screenY < height + 80) {
      const tilt = berry.baseTilt + Math.sin(time * 1.4 + berry.tiltPhase) * 0.16;
      drawFloatingStrawberry(
        ctx,
        berry.xRatio * width,
        screenY,
        berry.scale,
        tilt,
        berry.tintVariant,
        skyProgress
      );
    }
  }

  // 5b. Sky Flyers (Kuromi Airplane & Skye Helicopter at higher altitudes)
  for (const flyer of rc.flyers) {
    const screenY = groundScreenY + flyer.worldY - cameraY * 0.88 + Math.sin(flyer.bobPhase) * 8;
    if (screenY > -130 && screenY < height + 130) {
      const fx = flyer.xRatio * width;
      const dir = flyer.speed >= 0 ? 1 : -1;
      if (flyer.kind === 'kuromi_plane') {
        drawKuromiAirplane(ctx, fx, screenY, flyer.scale, dir, time);
      } else {
        drawSkyeHelicopter(ctx, fx, screenY, flyer.scale, dir, time);
      }
    }
  }

  // 6. Ground Table & Pedestal Cake Stand
  if (worldGroundY < height + 180) {
    drawBakeryTableAndStand(ctx, width, worldGroundY);
  }

  // 7. Stacked Cake Layers
  for (let i = 0; i < rc.layers.length; i++) {
    const layer = rc.layers[i];
    const screenY = groundScreenY + layer.y - cameraY;
    if (screenY < -140 || screenY - layer.height > height + 140) continue;

    // Gentle breeze sway for very tall towers (purely visual)
    const heightRatio = Math.max(0, i - 4) * 0.08;
    const swayOffset = Math.sin(time * 1.8 + i * 0.25) * Math.min(3.5, heightRatio);

    drawCakeLayerAtBottomLeft(
      ctx,
      layer.left + swayOffset,
      screenY,
      layer.width,
      layer.height,
      layer.flavor,
      layer.icingSeed,
      layer.squash,
      layer.decoration,
      time
    );
  }

  // 8. Soft drop-shadow projection on top layer when cake is falling nearby
  if (rc.swingingCake && rc.swingingCake.state === 'FALLING' && rc.layers.length > 0) {
    const topLayer = rc.layers[rc.layers.length - 1];
    const dist = topLayer.y - rc.swingingCake.height - (rc.swingingCake.y - rc.swingingCake.height);
    if (dist > 0 && dist < 130) {
      const shadowLeft = Math.max(topLayer.left, rc.swingingCake.x - rc.swingingCake.width / 2);
      const shadowRight = Math.min(topLayer.left + topLayer.width, rc.swingingCake.x + rc.swingingCake.width / 2);
      if (shadowRight > shadowLeft) {
        const topScreenY = groundScreenY + (topLayer.y - topLayer.height) - cameraY;
        const alpha = (1 - dist / 130) * 0.22;
        ctx.save();
        ctx.fillStyle = `rgba(92, 61, 46, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(
          (shadowLeft + shadowRight) / 2,
          topScreenY + 2,
          (shadowRight - shadowLeft) / 2,
          4,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // 9. Pendulum Rope & Swinging / Falling Cake
  if (rc.showPendulum && rc.swingingCake) {
    const cake = rc.swingingCake;
    const pivotScreenX = rc.pivotX;
    const pivotScreenY = rc.pivotY;

    if (cake.state === 'SWINGING') {
      const cakeCenterX = cake.x;
      const cakeTopScreenY = groundScreenY + (cake.y - cake.height) - cameraY;
      drawPendulumRibbon(ctx, pivotScreenX, pivotScreenY, cakeCenterX, cakeTopScreenY, true);
    } else {
      // Recoiled empty ribbon clasp after dropping
      const restY = pivotScreenY + Math.max(28, rc.ropeLength * 0.42 - rc.recoilOffset);
      drawPendulumRibbon(ctx, pivotScreenX, pivotScreenY, pivotScreenX, restY, false);
    }

    const cakeBottomScreenY = groundScreenY + cake.y - cameraY;
    ctx.save();
    ctx.translate(cake.x, cakeBottomScreenY - cake.height / 2);
    ctx.rotate(cake.tilt);
    drawCakeLayerAtBottomLeft(
      ctx,
      -cake.width / 2,
      cake.height / 2,
      cake.width,
      cake.height,
      cake.flavor,
      cake.icingSeed,
      1,
      undefined,
      time
    );
    ctx.restore();
  }

  // 10. Trimmed / Missed Falling Debris
  for (const piece of rc.debris) {
    const screenY = groundScreenY + piece.y - cameraY;
    if (screenY > height + 150) continue;
    ctx.save();
    ctx.globalAlpha = piece.alpha;
    ctx.translate(piece.x, screenY);
    ctx.rotate(piece.angle);
    drawCakeLayerAtBottomLeft(
      ctx,
      -piece.width / 2,
      piece.height / 2,
      piece.width,
      piece.height,
      piece.flavor,
      piece.icingSeed,
      1,
      undefined,
      time
    );
    ctx.restore();
  }

  // 11. Impact Rings
  for (const ring of rc.rings) {
    const screenY = groundScreenY + ring.y - cameraY;
    const progress = 1 - ring.life / ring.maxLife;
    const currentR = lerp(ring.radius, ring.maxRadius, progress);
    ctx.save();
    ctx.globalAlpha = (ring.life / ring.maxLife) * 0.85;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 3.5 * (ring.life / ring.maxLife);
    ctx.beginPath();
    ctx.ellipse(ring.x, screenY, currentR, currentR * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 12. Particles (stars, confetti, icing crumbs)
  for (const p of rc.particles) {
    const screenY = groundScreenY + p.y - cameraY;
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, screenY);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;

    if (p.shape === 'star') {
      drawFourPointStar(ctx, 0, 0, p.size);
    } else if (p.shape === 'confetti') {
      ctx.fillRect(-p.size * 0.8, -p.size * 0.4, p.size * 1.6, p.size * 0.8);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
      if (p.shape === 'crumb') {
        ctx.strokeStyle = OUTLINE_COLOR;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 13. Floating Callouts (PERFECT!, +Combo)
  for (const c of rc.callouts) {
    const screenY = groundScreenY + c.y - cameraY;
    const alpha = Math.min(1, (c.life / c.maxLife) * 1.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = '700 22px "Fredoka", "Noto Sans TC", sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#FFFDF9';
    ctx.strokeText(c.text, c.x, screenY);
    ctx.fillStyle = c.color;
    ctx.fillText(c.text, c.x, screenY);

    if (c.subtext) {
      ctx.font = '700 13px "Quicksand", "Noto Sans TC", sans-serif';
      ctx.lineWidth = 3.5;
      ctx.strokeText(c.subtext, c.x, screenY + 20);
      ctx.fillStyle = OUTLINE_COLOR;
      ctx.fillText(c.subtext, c.x, screenY + 20);
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawFourPointStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.38;
    const a = (i * Math.PI) / 4;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawHandDrawnCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  skyProgress: number,
  variant: 'classic' | 'strawberry',
  label?: string
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const isNight = skyProgress > 0.65;
  if (variant === 'strawberry') {
    ctx.fillStyle = isNight ? 'rgba(255, 182, 209, 0.42)' : 'rgba(255, 214, 229, 0.92)';
    ctx.strokeStyle = isNight ? 'rgba(255, 196, 220, 0.5)' : 'rgba(219, 90, 128, 0.36)';
  } else {
    ctx.fillStyle = isNight ? 'rgba(255, 245, 248, 0.25)' : 'rgba(255, 253, 249, 0.85)';
    ctx.strokeStyle = isNight ? 'rgba(255, 245, 248, 0.35)' : 'rgba(92, 61, 46, 0.16)';
  }
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(-36, 12);
  ctx.bezierCurveTo(-48, 12, -50, -6, -34, -10);
  ctx.bezierCurveTo(-30, -28, -4, -32, 6, -18);
  ctx.bezierCurveTo(18, -30, 42, -22, 40, -4);
  ctx.bezierCurveTo(52, -2, 50, 12, 36, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (variant === 'strawberry') {
    // Soft strawberry-cream top highlight
    ctx.fillStyle = isNight ? 'rgba(255, 240, 246, 0.2)' : 'rgba(255, 248, 251, 0.72)';
    ctx.beginPath();
    ctx.ellipse(-10, -14, 12, 5, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Cute golden strawberry seeds
    ctx.fillStyle = isNight ? 'rgba(255, 224, 130, 0.55)' : 'rgba(255, 183, 3, 0.65)';
    const seedPositions = [
      [-24, 1],
      [-12, -7],
      [2, -2],
      [18, -8],
      [28, 3],
    ];
    for (const [sx, sy] of seedPositions) {
      ctx.beginPath();
      ctx.ellipse(sx, sy, 1.3, 2, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mini hand-drawn strawberry & green leafy calyx perched on the cloud
    ctx.save();
    ctx.translate(22, -18);
    ctx.rotate(0.18);
    ctx.fillStyle = '#FF4D6D';
    ctx.strokeStyle = isNight ? 'rgba(92, 61, 46, 0.55)' : 'rgba(92, 61, 46, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.bezierCurveTo(8, -6, 9, 4, 0, 9);
    ctx.bezierCurveTo(-9, 4, -8, -6, 0, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Leaf crown
    ctx.fillStyle = '#74C69D';
    ctx.beginPath();
    ctx.moveTo(-6, -5);
    ctx.quadraticCurveTo(0, -10, 6, -5);
    ctx.quadraticCurveTo(0, -3, -6, -5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (label) {
    ctx.fillStyle = isNight ? 'rgba(255, 253, 249, 0.7)' : 'rgba(92, 61, 46, 0.45)';
    ctx.font = '700 11px "Fredoka", "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 4);
  }

  ctx.restore();
}

function drawKuromiAirplane(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  dir: 1 | -1,
  time: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * scale, scale);

  // Cute trailing puff clouds behind the plane
  for (let i = 0; i < 3; i++) {
    const puffOffset = ((time * 28 + i * 16) % 48);
    const puffAlpha = Math.max(0, 0.65 - puffOffset / 52);
    ctx.fillStyle = `rgba(255, 240, 248, ${puffAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(-48 - puffOffset, -2 + Math.sin(time * 5 + i) * 3, 4.5 + i * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';

  // Tail fin
  ctx.fillStyle = '#FF85B3';
  ctx.beginPath();
  ctx.moveTo(-30, -2);
  ctx.lineTo(-42, -18);
  ctx.lineTo(-24, -14);
  ctx.lineTo(-18, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Kuromi's fluttering pink aviator scarf
  const scarfWave = Math.sin(time * 11) * 4;
  ctx.fillStyle = '#FF4D6D';
  ctx.beginPath();
  ctx.moveTo(-8, -14);
  ctx.quadraticCurveTo(-22, -19 + scarfWave, -32, -12 + scarfWave);
  ctx.quadraticCurveTo(-20, -9 + scarfWave, -8, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Kuromi sitting in the open cockpit
  ctx.save();
  ctx.translate(2, -18);

  // Left & Right pointed jester ears with pink pom-poms
  [-1, 1].forEach((side) => {
    ctx.fillStyle = '#3D2B3D';
    ctx.beginPath();
    ctx.moveTo(side * 4, -8);
    ctx.quadraticCurveTo(side * 12, -23, side * 14, -27);
    ctx.quadraticCurveTo(side * 6, -21, side * 10, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pink pom-pom ball at ear tip
    ctx.fillStyle = '#FF85B3';
    ctx.beginPath();
    ctx.arc(side * 14, -27, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Jester hood head
  ctx.fillStyle = '#3D2B3D';
  ctx.beginPath();
  ctx.ellipse(0, -3, 13, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // White face cutout
  ctx.fillStyle = '#FFFDF9';
  ctx.beginPath();
  ctx.ellipse(2, -1, 9.5, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pink skull emblem on hood forehead
  ctx.fillStyle = '#FF85B3';
  ctx.beginPath();
  ctx.arc(0, -10.5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3D2B3D';
  ctx.beginPath();
  ctx.arc(-1, -10.5, 0.7, 0, Math.PI * 2);
  ctx.arc(1, -10.5, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Cute expressive eyes & rosy cheeks
  ctx.fillStyle = '#3D2B3D';
  ctx.beginPath();
  ctx.arc(-1.5, -1.5, 1.5, 0, Math.PI * 2);
  ctx.arc(6.5, -1.5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 133, 179, 0.65)';
  ctx.beginPath();
  ctx.arc(-4, 1.5, 2.1, 0, Math.PI * 2);
  ctx.arc(8.5, 1.5, 2.1, 0, Math.PI * 2);
  ctx.fill();

  // Cheeky smile
  ctx.strokeStyle = '#3D2B3D';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(2.8, 0.5, 2.2, 0.1, Math.PI - 0.1);
  ctx.stroke();

  ctx.restore();

  // Airplane fuselage (lavender pastel body)
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.2;
  ctx.fillStyle = '#C8B6FF';
  ctx.beginPath();
  ctx.moveTo(-34, -2);
  ctx.quadraticCurveTo(-10, -15, 24, -12);
  ctx.quadraticCurveTo(38, -10, 38, 0);
  ctx.quadraticCurveTo(38, 11, 20, 12);
  ctx.quadraticCurveTo(-12, 13, -34, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cockpit rim & stripe
  ctx.fillStyle = '#FF9EBB';
  roundRectPath(ctx, -16, -2, 38, 5, 2.5);
  ctx.fill();

  // Airplane wing
  ctx.fillStyle = '#FFFDF9';
  ctx.beginPath();
  ctx.ellipse(4, 5, 14, 5.5, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Landing wheel
  ctx.beginPath();
  ctx.moveTo(14, 12);
  ctx.lineTo(18, 20);
  ctx.stroke();
  ctx.fillStyle = '#5C3D2E';
  ctx.beginPath();
  ctx.arc(18, 21, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFE082';
  ctx.beginPath();
  ctx.arc(18, 21, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Nose spinner & animated spinning propeller
  ctx.fillStyle = '#FFE082';
  ctx.beginPath();
  ctx.arc(39, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const propHeight = 4 + Math.abs(Math.sin(time * 34)) * 18;
  ctx.fillStyle = 'rgba(255, 253, 249, 0.85)';
  ctx.beginPath();
  ctx.ellipse(42, 0, 2.6, propHeight, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawSkyeHelicopter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  dir: 1 | -1,
  time: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * scale, scale);

  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';

  // Landing skids
  ctx.beginPath();
  ctx.moveTo(-10, 14);
  ctx.lineTo(-14, 22);
  ctx.moveTo(14, 14);
  ctx.lineTo(18, 22);
  ctx.moveTo(-22, 22);
  ctx.lineTo(26, 22);
  ctx.quadraticCurveTo(31, 22, 33, 18);
  ctx.stroke();

  // Tail boom
  ctx.fillStyle = '#FF9EBB';
  ctx.beginPath();
  ctx.moveTo(-16, -4);
  ctx.lineTo(-44, -9);
  ctx.lineTo(-44, -3);
  ctx.lineTo(-16, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tail fin & spinning tail rotor
  ctx.fillStyle = '#FF4D6D';
  ctx.beginPath();
  ctx.moveTo(-40, -8);
  ctx.lineTo(-48, -19);
  ctx.lineTo(-37, -17);
  ctx.lineTo(-34, -7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.translate(-44, -9);
  ctx.rotate(time * 24);
  ctx.fillStyle = '#FFFDF9';
  ctx.beginPath();
  ctx.ellipse(0, 0, 2, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Helicopter main cabin (bright Skye pink!)
  ctx.fillStyle = '#FF85B3';
  ctx.beginPath();
  ctx.ellipse(4, 0, 27, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // White racing stripe & cute paw badge on cabin side
  ctx.fillStyle = '#FFFDF9';
  roundRectPath(ctx, -17, 2, 18, 5, 2.5);
  ctx.fill();

  ctx.fillStyle = '#FFE082';
  ctx.beginPath();
  ctx.arc(-8, -4, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FF4D6D';
  ctx.beginPath();
  ctx.arc(-8, -3.5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Transparent sky-blue cockpit bubble
  ctx.fillStyle = 'rgba(216, 243, 255, 0.85)';
  ctx.beginPath();
  ctx.arc(14, -2, 14, -Math.PI * 0.65, Math.PI * 0.42);
  ctx.quadraticCurveTo(10, 6, 4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Skye (PAW Patrol cockapoo pup) inside cockpit
  ctx.save();
  ctx.translate(13, -1);

  // Fluffy golden-apricot floppy ear
  ctx.fillStyle = '#DDA15E';
  ctx.beginPath();
  ctx.ellipse(-6, 1, 4.5, 8, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Pup head
  ctx.fillStyle = '#F4C38D';
  ctx.beginPath();
  ctx.arc(1, -2, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cream muzzle & cute nose
  ctx.fillStyle = '#FFFDF9';
  ctx.beginPath();
  ctx.ellipse(5, 0.5, 4.5, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5C3D2E';
  ctx.beginPath();
  ctx.arc(8, -0.5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Big bright pup eye
  ctx.fillStyle = '#5C3D2E';
  ctx.beginPath();
  ctx.arc(4, -3.5, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // Pink pilot helmet + aviator goggles on forehead!
  ctx.fillStyle = '#FF4D6D';
  ctx.beginPath();
  ctx.arc(0, -4, 8.2, Math.PI * 0.95, Math.PI * 2.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#A2D2FF';
  roundRectPath(ctx, 1, -10.5, 8, 4.5, 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();

  // Cockpit glass shine
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(16, -3, 10, -Math.PI * 0.45, -Math.PI * 0.1);
  ctx.stroke();

  // Overhead rotor mast & fast-spinning rotor blades
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(4, -17);
  ctx.lineTo(4, -24);
  ctx.stroke();

  const bladeSpan = 10 + Math.abs(Math.cos(time * 26)) * 34;
  // Soft motion blur disc
  ctx.fillStyle = 'rgba(255, 253, 249, 0.38)';
  ctx.beginPath();
  ctx.ellipse(4, -24, 42, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crisp spinning blade bar
  ctx.fillStyle = '#FFE082';
  roundRectPath(ctx, 4 - bladeSpan, -26, bladeSpan * 2, 4, 2);
  ctx.fill();
  ctx.stroke();

  // Rotor hub cap
  ctx.fillStyle = '#FF4D6D';
  ctx.beginPath();
  ctx.arc(4, -24, 3.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawFloatingStrawberry(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  tilt: number,
  tintVariant: 0 | 1 | 2,
  skyProgress: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);

  // Subtle depth opacity for smaller distant berries
  const depthAlpha = scale < 0.6 ? 0.78 : 0.94;
  ctx.globalAlpha = skyProgress > 0.7 ? depthAlpha * 0.88 : depthAlpha;

  const berryColors = ['#FF4D6D', '#FF6B8B', '#FF85A1'];
  const highlightColors = ['#FF9EBB', '#FFB3C6', '#FFC2D4'];

  // Plump hand-drawn strawberry heart silhouette
  ctx.fillStyle = berryColors[tintVariant];
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.bezierCurveTo(14, -12, 16, 4, 0, 17);
  ctx.bezierCurveTo(-16, 4, -14, -12, 0, -11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Soft glossy cheek highlight
  ctx.fillStyle = highlightColors[tintVariant];
  ctx.beginPath();
  ctx.ellipse(-5, -3, 3, 5.5, 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Golden seeds
  ctx.fillStyle = '#FFE082';
  const seeds = [
    [-5, 2],
    [4, -3],
    [0, 4],
    [-3, 9],
    [5, 6],
  ];
  for (const [sx, sy] of seeds) {
    ctx.beginPath();
    ctx.ellipse(sx, sy, 1.1, 1.8, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mint-green leafy calyx & little stem
  ctx.fillStyle = '#74C69D';
  ctx.beginPath();
  ctx.moveTo(-10, -10);
  ctx.quadraticCurveTo(-5, -16, 0, -11);
  ctx.quadraticCurveTo(5, -16, 10, -10);
  ctx.quadraticCurveTo(4, -7, 0, -9);
  ctx.quadraticCurveTo(-4, -7, -10, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.quadraticCurveTo(2, -17, 5, -18);
  ctx.stroke();

  ctx.restore();
}

function drawBakeryTableAndStand(ctx: CanvasRenderingContext2D, width: number, groundScreenY: number): void {
  ctx.save();

  // Warm pastel bakery tablecloth / counter surface
  const tableTop = groundScreenY + 26;
  ctx.fillStyle = '#FFE8D6';
  ctx.fillRect(0, tableTop, width, 300);

  // Gingham pastel stripes
  ctx.fillStyle = 'rgba(255, 158, 187, 0.22)';
  const stripeW = 36;
  for (let x = 0; x < width; x += stripeW * 2) {
    ctx.fillRect(x, tableTop, stripeW, 300);
  }

  // Table rim outline
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, tableTop);
  ctx.lineTo(width, tableTop);
  ctx.stroke();

  // Ceramic Scalloped Cake Stand centered at width / 2
  const cx = width / 2;
  const standW = 224;
  const plateH = 14;

  // Stand pedestal foot
  ctx.fillStyle = '#FFFDF9';
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(cx - 26, groundScreenY + 8);
  ctx.lineTo(cx + 26, groundScreenY + 8);
  ctx.quadraticCurveTo(cx + 22, groundScreenY + 24, cx + 44, tableTop);
  ctx.lineTo(cx - 44, tableTop);
  ctx.quadraticCurveTo(cx - 22, groundScreenY + 24, cx - 26, groundScreenY + 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Stand plate with pastel mint accent rim
  ctx.fillStyle = '#A8E6CF';
  roundRectPath(ctx, cx - standW / 2, groundScreenY, standW, plateH, 7);
  ctx.fill();
  ctx.stroke();

  // Cream top highlight on plate
  ctx.fillStyle = '#FFFDF9';
  roundRectPath(ctx, cx - standW / 2 + 4, groundScreenY + 2, standW - 8, 5, 3);
  ctx.fill();

  ctx.restore();
}

function drawPendulumRibbon(
  ctx: CanvasRenderingContext2D,
  pivotX: number,
  pivotY: number,
  endX: number,
  endY: number,
  holdingCake: boolean
): void {
  ctx.save();

  // Top anchor peg
  ctx.fillStyle = '#FFB703';
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Candy striped ribbon cord
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(endX, endY - 6);
  ctx.stroke();

  ctx.strokeStyle = '#FF9EBB';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(endX, endY - 6);
  ctx.stroke();

  // Cute wooden/gold pastry clasp holding the cake
  ctx.translate(endX, endY - 4);
  const spread = holdingCake ? 9 : 15;

  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.4;
  ctx.fillStyle = '#FFE082';

  // Left prong
  ctx.beginPath();
  ctx.moveTo(-2, -6);
  ctx.quadraticCurveTo(-spread, 0, -spread + 3, 7);
  ctx.stroke();

  // Right prong
  ctx.beginPath();
  ctx.moveTo(2, -6);
  ctx.quadraticCurveTo(spread, 0, spread - 3, 7);
  ctx.stroke();

  // Center clasp bow/cap
  ctx.beginPath();
  ctx.arc(0, -6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawCakeLayerAtBottomLeft(
  ctx: CanvasRenderingContext2D,
  left: number,
  bottomY: number,
  width: number,
  height: number,
  flavor: FlavorConfig,
  icingSeed: number,
  squash: number,
  decoration: StageDecoration | undefined,
  time: number
): void {
  if (width <= 0.5) return;

  ctx.save();
  // Apply squash & stretch anchored at bottom center
  const cx = left + width / 2;
  ctx.translate(cx, bottomY);
  const scaleX = squash;
  const scaleY = 1 / Math.max(0.75, squash);
  ctx.scale(scaleX, scaleY);

  const w = width;
  const h = height;
  const x0 = -w / 2;
  const y0 = -h;
  const radius = Math.min(8, w * 0.25);

  // 1. Main Sponge Body
  ctx.fillStyle = flavor.sponge;
  roundRectPath(ctx, x0, y0, w, h, radius);
  ctx.fill();

  // Clip inside cake body for filling & shading
  ctx.save();
  roundRectPath(ctx, x0, y0, w, h, radius);
  ctx.clip();

  // Subtle bottom shadow strip
  ctx.fillStyle = flavor.spongeShadow;
  ctx.fillRect(x0, y0 + h - 7, w, 8);

  // Cream middle filling band
  ctx.fillStyle = flavor.filling;
  ctx.fillRect(x0, y0 + h * 0.52, w, 6.5);

  // Hand-drawn crumb dots
  if (w >= 16) {
    ctx.fillStyle = flavor.spongeShadow;
    const crumbCount = Math.max(2, Math.floor(w / 28));
    for (let i = 0; i < crumbCount; i++) {
      const dx = x0 + 6 + seededRand(icingSeed, i + 10) * Math.max(2, w - 12);
      const dy = y0 + h * 0.78 + (seededRand(icingSeed, i + 30) - 0.5) * 6;
      ctx.beginPath();
      ctx.arc(dx, dy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Scalloped Drip Icing along the top
  const dripBaseY = y0 + 12;
  ctx.fillStyle = flavor.icing;
  ctx.beginPath();
  ctx.moveTo(x0 - 2, y0 - 2);
  ctx.lineTo(x0 + w + 2, y0 - 2);
  ctx.lineTo(x0 + w + 2, dripBaseY);

  const bumps = Math.max(2, Math.round(w / 24));
  const step = w / bumps;
  for (let i = bumps - 1; i >= 0; i--) {
    const bx = x0 + i * step;
    const dropDepth = 5 + seededRand(icingSeed, i) * 7;
    ctx.quadraticCurveTo(bx + step * 0.5, dripBaseY + dropDepth, bx, dripBaseY);
  }
  ctx.closePath();
  ctx.fill();

  // Icing top highlight sheen
  if (w >= 14) {
    ctx.fillStyle = flavor.icingHighlight;
    ctx.globalAlpha = 0.65;
    roundRectPath(ctx, x0 + 5, y0 + 2.5, Math.max(2, w - 10), 4, 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Icing bottom outline curve
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x0, dripBaseY);
  for (let i = 0; i < bumps; i++) {
    const bx = x0 + i * step;
    const dropDepth = 5 + seededRand(icingSeed, i) * 7;
    ctx.quadraticCurveTo(bx + step * 0.5, dripBaseY + dropDepth, bx + step, dripBaseY);
  }
  ctx.stroke();

  // 3. Pastel Sprinkles on icing
  if (w >= 14) {
    const sprinkleCount = Math.max(1, Math.floor(w / 22));
    for (let i = 0; i < sprinkleCount; i++) {
      const sx = x0 + 6 + seededRand(icingSeed, i + 50) * Math.max(2, w - 12);
      const sy = y0 + 5 + seededRand(icingSeed, i + 70) * 5;
      const sAngle = (seededRand(icingSeed, i + 90) - 0.5) * 1.4;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(sAngle);
      ctx.fillStyle = flavor.sprinkles[i % flavor.sprinkles.length];
      roundRectPath(ctx, -3, -1.3, 6, 2.6, 1.3);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();

  // 4. Outer Hand-Drawn Cocoa Outline
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2.4;
  roundRectPath(ctx, x0, y0, w, h, radius);
  ctx.stroke();

  // 5. Optional Stage Milestone Decoration perched on top edge
  if (decoration && w > 28) {
    drawStageDecoration(ctx, 0, y0, w, decoration, time);
  }

  ctx.restore();
}

function drawStageDecoration(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  cakeWidth: number,
  decoration: StageDecoration,
  time: number
): void {
  ctx.save();
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = 2;

  if (decoration === 'cherry') {
    // Stem
    ctx.beginPath();
    ctx.moveTo(cx, topY - 8);
    ctx.quadraticCurveTo(cx + 4, topY - 22, cx + 11, topY - 24);
    ctx.stroke();
    // Leaf
    ctx.fillStyle = '#74C69D';
    ctx.beginPath();
    ctx.ellipse(cx + 8, topY - 20, 6, 3, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Glossy Berry
    ctx.fillStyle = '#FF4D6D';
    ctx.beginPath();
    ctx.arc(cx, topY - 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFDF9';
    ctx.beginPath();
    ctx.arc(cx - 2.5, topY - 8.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (decoration === 'macaron') {
    const offset = Math.min(22, cakeWidth * 0.25);
    [-offset, offset].forEach((ox, idx) => {
      const mx = cx + ox;
      const my = topY - 5;
      ctx.fillStyle = idx === 0 ? '#FF9EBB' : '#A8E6CF';
      roundRectPath(ctx, mx - 11, my - 7, 22, 6, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFDF9';
      ctx.fillRect(mx - 9, my - 1, 18, 3);
      ctx.fillStyle = idx === 0 ? '#FF9EBB' : '#A8E6CF';
      roundRectPath(ctx, mx - 11, my + 1, 22, 5, 2.5);
      ctx.fill();
      ctx.stroke();
    });
  } else if (decoration === 'candle') {
    ctx.fillStyle = '#A2D2FF';
    roundRectPath(ctx, cx - 4, topY - 22, 8, 22, 2);
    ctx.fill();
    ctx.stroke();
    // Flickering flame
    const flicker = Math.sin(time * 12) * 1.3;
    ctx.fillStyle = '#FFB703';
    ctx.beginPath();
    ctx.moveTo(cx, topY - 35 + flicker);
    ctx.quadraticCurveTo(cx + 6, topY - 27, cx, topY - 23);
    ctx.quadraticCurveTo(cx - 6, topY - 27, cx, topY - 35 + flicker);
    ctx.fill();
    ctx.stroke();
  } else if (decoration === 'crown') {
    ctx.fillStyle = '#FFD166';
    ctx.beginPath();
    ctx.moveTo(cx - 14, topY);
    ctx.lineTo(cx - 16, topY - 16);
    ctx.lineTo(cx - 7, topY - 8);
    ctx.lineTo(cx, topY - 20);
    ctx.lineTo(cx + 7, topY - 8);
    ctx.lineTo(cx + 16, topY - 16);
    ctx.lineTo(cx + 14, topY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (decoration === 'pennant') {
    const span = Math.min(48, cakeWidth * 0.42);
    // Two poles
    ctx.beginPath();
    ctx.moveTo(cx - span, topY);
    ctx.lineTo(cx - span, topY - 26);
    ctx.moveTo(cx + span, topY);
    ctx.lineTo(cx + span, topY - 26);
    ctx.moveTo(cx - span, topY - 24);
    ctx.quadraticCurveTo(cx, topY - 14, cx + span, topY - 24);
    ctx.stroke();

    const flagColors = ['#FF4D6D', '#FFB703', '#A8E6CF'];
    for (let i = -1; i <= 1; i++) {
      const fx = cx + i * (span * 0.45);
      const fy = topY - 19;
      ctx.fillStyle = flagColors[i + 1];
      ctx.beginPath();
      ctx.moveTo(fx - 5, fy);
      ctx.lineTo(fx + 5, fy);
      ctx.lineTo(fx, fy + 9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const safeW = Math.max(0, w);
  const safeH = Math.max(0, h);
  const radius = Math.max(0, Math.min(r, safeW / 2, safeH / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + safeW - radius, y);
  ctx.quadraticCurveTo(x + safeW, y, x + safeW, y + radius);
  ctx.lineTo(x + safeW, y + safeH - radius);
  ctx.quadraticCurveTo(x + safeW, y + safeH, x + safeW - radius, y + safeH);
  ctx.lineTo(x + radius, y + safeH);
  ctx.quadraticCurveTo(x, y + safeH, x, y + safeH - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
