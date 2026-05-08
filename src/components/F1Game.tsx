"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

const TEAM_PALETTE = [
  { color: "#3671C6", label: "RBR" },
  { color: "#E8002D", label: "FER" },
  { color: "#27F4D2", label: "MER" },
  { color: "#FF8000", label: "MCL" },
  { color: "#229971", label: "AMR" },
  { color: "#0093CC", label: "ALP" },
  { color: "#64C4FF", label: "WIL" },
  { color: "#6692FF", label: "RB" },
  { color: "#B6BABD", label: "HAS" },
  { color: "#DE3226", label: "AUD" },
  { color: "#1B2D4B", label: "CAD" },
];

const RACE_NAMES = [
  "Australia", "China", "Japan", "Miami", "Canada", "Monaco",
  "Barcelona", "Austria", "Britain", "Belgium", "Hungary",
  "Netherlands", "Italy", "Spain", "Azerbaijan", "Singapore",
  "Austin", "Mexico", "Brazil", "Las Vegas", "Qatar", "Abu Dhabi",
];

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
}
interface Barrier {
  y: number; gapX: number; gapW: number;
  color: string; label: string; raceName: string;
  height: number; scored: boolean;
}
interface SpeedLine {
  x: number; y: number; len: number; speed: number;
}
interface RacingLinePoint {
  x: number; y: number;
}
interface LeaderboardEntry {
  id: string; playerName: string; score: number; createdAt: string;
}

// Car dimensions (top-down view, nose pointing up)
const CAR_W = 30;
const CAR_H = 50;

// Car Y position ratio (75% down from top)
const CAR_Y_RATIO = 0.75;

// Steering physics
const STEER_DECEL = 0.15; // drift back toward center
const MAX_STEER_VEL = 6;
const STEER_SMOOTHING = 0.25;

// Track layout
const TRACK_MARGIN_RATIO = 0.12; // grass/runoff on each side
const KERB_W = 6; // kerb strip width

// Barriers
const BARRIER_HEIGHT = 20;
const INITIAL_GAP_W = 140;
const MIN_GAP_W = 70;
const INITIAL_SPEED = 2.5;
const MAX_SPEED = 8;
const BARRIER_SPACING = 220;
const BARRIER_FADE_DISTANCE = 100;

// Effects
const PARTICLE_SPAWN_RATE = 0.6;
const SPEED_LINE_COUNT = 20;

// Delta-time baseline (60fps)
const TARGET_DT = 1000 / 60;

// Screen shake
const SHAKE_DURATION = 300;
const SHAKE_INTENSITY = 6;

export default function F1Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  // Pre-rendered asphalt texture
  const asphaltCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const stateRef = useRef({
    running: false,
    gameOver: false,
    score: 0,
    carX: 0, // center of track
    carVX: 0,
    steerDir: 0 as -1 | 0 | 1, // current steering input
    barriers: [] as Barrier[],
    particles: [] as Particle[],
    speedLines: [] as SpeedLine[],
    speed: INITIAL_SPEED,
    gapSize: INITIAL_GAP_W,
    distance: 0,
    w: 400,
    h: 600,
    laneOffset: 0, // scrolling lane markings
    bestScore: 0,
    raceIndex: 0,
    lastFrameTime: 0,
    shakeUntil: 0,
    shakeOffsetX: 0,
    shakeOffsetY: 0,
    // Touch tracking
    touchId: null as number | null,
    touchStartX: 0,
  });

  const animRef = useRef<number>(0);
  const endGameRef = useRef<() => void>(() => {});
  const [displayScore, setDisplayScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [scoreSaved, setScoreSaved] = useState(false);
  const [bestScore, setBestScore] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/game");
      if (res.ok) { setLeaderboard(await res.json()); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // Pre-render asphalt grain texture
  const buildAsphaltTexture = useCallback((w: number, h: number) => {
    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext("2d");
    if (!octx) return null;
    octx.fillStyle = "#2a2a2a";
    octx.fillRect(0, 0, w, h);
    octx.fillStyle = "rgba(0,0,0,0.15)";
    for (let tx = 0; tx < w; tx += 6) {
      for (let ty = 0; ty < h + 40; ty += 8) {
        if ((tx + ty) % 12 === 0) octx.fillRect(tx, ty, 2, 2);
      }
    }
    return offscreen;
  }, []);

  // Track geometry helpers
  const getTrackLeft = useCallback((w: number) => Math.floor(w * TRACK_MARGIN_RATIO), []);
  const getTrackRight = useCallback((w: number) => Math.floor(w * (1 - TRACK_MARGIN_RATIO)), []);
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.min(Math.floor(rect.width / 0.7), 600);
    canvas.width = w;
    canvas.height = h;
    stateRef.current.w = w;
    stateRef.current.h = h;
    asphaltCanvasRef.current = buildAsphaltTexture(w, h + 40);
  }, [buildAsphaltTexture]);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  const initSpeedLines = useCallback(() => {
    const s = stateRef.current;
    s.speedLines = [];
    for (let i = 0; i < SPEED_LINE_COUNT; i++) {
      const trackL = getTrackLeft(s.w);
      const trackR = getTrackRight(s.w);
      s.speedLines.push({
        x: trackL + Math.random() * (trackR - trackL),
        y: Math.random() * s.h,
        len: 15 + Math.random() * 35,
        speed: 2 + Math.random() * 4,
      });
    }
  }, [getTrackLeft, getTrackRight]);

  // Draw top-down F1 car (nose pointing UP)
  function drawCar(
    ctx: CanvasRenderingContext2D,
    cx: number, cy: number,
  ) {
    ctx.save();
    ctx.translate(cx, cy);

    const w = CAR_W;
    const h = CAR_H;
    const halfW = w / 2;
    const halfH = h / 2;

    // --- EXHAUST FLAME (bottom/rear of car) ---
    const flameLen = 6 + Math.random() * 8;
    const flameGrad = ctx.createLinearGradient(0, halfH, 0, halfH + flameLen);
    flameGrad.addColorStop(0, "rgba(255, 100, 0, 0.7)");
    flameGrad.addColorStop(0.4, "rgba(255, 200, 0, 0.5)");
    flameGrad.addColorStop(1, "rgba(255, 50, 0, 0)");
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-3, halfH);
    ctx.quadraticCurveTo(-2, halfH + flameLen * 0.7, 0, halfH + flameLen);
    ctx.quadraticCurveTo(2, halfH + flameLen * 0.7, 3, halfH);
    ctx.closePath();
    ctx.fill();

    // --- REAR WING (bottom of car) ---
    ctx.fillStyle = "#cc0022";
    ctx.fillRect(-halfW - 2, halfH - 4, w + 4, 3);
    // Wing endplates
    ctx.fillRect(-halfW - 3, halfH - 6, 3, 8);
    ctx.fillRect(halfW, halfH - 6, 3, 8);

    // --- REAR WHEELS ---
    ctx.fillStyle = "#1a1a1a";
    // Left rear
    ctx.beginPath();
    ctx.ellipse(-halfW - 2, halfH * 0.5, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right rear
    ctx.beginPath();
    ctx.ellipse(halfW + 2, halfH * 0.5, 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wheel centers
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(-halfW - 2, halfH * 0.5, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(halfW + 2, halfH * 0.5, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- ENGINE COVER / AIRBOX ---
    ctx.fillStyle = "#b0001f";
    ctx.beginPath();
    ctx.moveTo(-4, -halfH * 0.1);
    ctx.lineTo(-3, halfH * 0.4);
    ctx.lineTo(-6, halfH * 0.65);
    ctx.lineTo(-6, halfH * 0.85);
    ctx.lineTo(6, halfH * 0.85);
    ctx.lineTo(6, halfH * 0.65);
    ctx.lineTo(3, halfH * 0.4);
    ctx.lineTo(4, -halfH * 0.1);
    ctx.closePath();
    ctx.fill();

    // --- MAIN BODY (top-down, wider at rear) ---
    ctx.fillStyle = "#E8002D";
    ctx.beginPath();
    // Nose (top, narrow)
    ctx.moveTo(0, -halfH * 1.05);
    ctx.lineTo(-4, -halfH * 0.85);
    ctx.lineTo(-6, -halfH * 0.6);
    // Sidepods (wider)
    ctx.lineTo(-halfW * 0.85, -halfH * 0.2);
    ctx.lineTo(-halfW * 0.9, halfH * 0.1);
    ctx.lineTo(-halfW * 0.85, halfH * 0.4);
    // Rear (widest)
    ctx.lineTo(-halfW * 0.7, halfH * 0.7);
    ctx.lineTo(-5, halfH * 0.85);
    ctx.lineTo(5, halfH * 0.85);
    ctx.lineTo(halfW * 0.7, halfH * 0.7);
    ctx.lineTo(halfW * 0.85, halfH * 0.4);
    ctx.lineTo(halfW * 0.9, halfH * 0.1);
    ctx.lineTo(halfW * 0.85, -halfH * 0.2);
    ctx.lineTo(6, -halfH * 0.6);
    ctx.lineTo(4, -halfH * 0.85);
    ctx.closePath();
    ctx.fill();

    // --- NOSE CONE (top tip) ---
    ctx.fillStyle = "#ff1a3a";
    ctx.beginPath();
    ctx.moveTo(0, -halfH * 1.1);
    ctx.lineTo(-3, -halfH * 0.85);
    ctx.lineTo(-3, -halfH * 0.7);
    ctx.lineTo(3, -halfH * 0.7);
    ctx.lineTo(3, -halfH * 0.85);
    ctx.closePath();
    ctx.fill();

    // --- COCKPIT ---
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(0, -halfH * 0.15, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- HALO ---
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-5, -halfH * 0.3);
    ctx.quadraticCurveTo(-6, -halfH * 0.45, -3, -halfH * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(5, -halfH * 0.3);
    ctx.quadraticCurveTo(6, -halfH * 0.45, 3, -halfH * 0.5);
    ctx.stroke();

    // --- DRIVER HELMET ---
    ctx.fillStyle = "#E8002D";
    ctx.beginPath();
    ctx.arc(0, -halfH * 0.2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(0, -halfH * 0.22, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // --- FRONT WHEELS ---
    ctx.fillStyle = "#1a1a1a";
    // Left front
    ctx.beginPath();
    ctx.ellipse(-halfW - 1, -halfH * 0.55, 3.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Right front
    ctx.beginPath();
    ctx.ellipse(halfW + 1, -halfH * 0.55, 3.5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wheel centers
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(-halfW - 1, -halfH * 0.55, 1.8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(halfW + 1, -halfH * 0.55, 1.8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- FRONT WING (top of car) ---
    ctx.fillStyle = "#cc0022";
    ctx.fillRect(-halfW - 4, -halfH * 0.75, w + 8, 2);
    ctx.fillStyle = "#E8002D";
    ctx.fillRect(-halfW - 6, -halfH * 0.82, w + 12, 1.5);

    // --- NUMBER ---
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `bold ${Math.round(h * 0.2)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", 0, halfH * 0.25);

    ctx.restore();
  }

  // Racing line through upcoming barrier gaps
  function computeRacingLine(s: typeof stateRef.current): RacingLinePoint[] {
    const points: RacingLinePoint[] = [];
    const carY = s.h * CAR_Y_RATIO;

    points.push({ x: s.carX, y: carY });

    const visible = s.barriers
      .filter(b => b.y + b.height > 0 && b.y < carY)
      .sort((a, b) => b.y - a.y); // closest first (top of screen)

    for (const b of visible) {
      const gapCenterX = b.gapX + b.gapW / 2;
      points.push({ x: gapCenterX, y: b.y + b.height + 15 });
      points.push({ x: gapCenterX, y: b.y + b.height / 2 });
    }

    if (points.length > 0) {
      const last = points[points.length - 1];
      points.push({ x: last.x, y: -50 });
    }

    return points;
  }

  function drawRacingLine(ctx: CanvasRenderingContext2D, points: RacingLinePoint[]) {
    if (points.length < 2) return;

    ctx.save();
    ctx.strokeStyle = "rgba(0, 255, 100, 0.15)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 12]);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpy = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, cpy, (prev.x + curr.x) / 2, cpy);
      ctx.quadraticCurveTo(curr.x, cpy, curr.x, curr.y);
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Main render function (used by game loop and final frame)
  const renderFrame = useCallback(function renderFrame(
    ctx: CanvasRenderingContext2D,
    s: typeof stateRef.current,
    showRacingLine: boolean,
  ) {
    const trackL = getTrackLeft(s.w);
    const trackR = getTrackRight(s.w);

    ctx.clearRect(-10, -10, s.w + 20, s.h + 20);

    // --- GRASS on both sides ---
    ctx.fillStyle = "#1a5c1a";
    ctx.fillRect(0, 0, trackL, s.h);
    ctx.fillRect(trackR, 0, s.w - trackR, s.h);

    // Grass texture stripes
    ctx.fillStyle = "rgba(30, 110, 30, 0.3)";
    for (let gy = (-s.laneOffset * 0.3) % 12; gy < s.h; gy += 12) {
      ctx.fillRect(0, gy, trackL, 3);
      ctx.fillRect(trackR, gy, s.w - trackR, 3);
    }

    // --- KERBS (red/white alternating on track edges) ---
    const kerbSize = 10;
    for (let ky = (-s.laneOffset) % (kerbSize * 2); ky < s.h; ky += kerbSize * 2) {
      // Left kerb
      ctx.fillStyle = "#E8002D";
      ctx.fillRect(trackL, ky, KERB_W, kerbSize);
      ctx.fillStyle = "#fff";
      ctx.fillRect(trackL, ky + kerbSize, KERB_W, kerbSize);
      // Right kerb
      ctx.fillStyle = "#fff";
      ctx.fillRect(trackR - KERB_W, ky, KERB_W, kerbSize);
      ctx.fillStyle = "#E8002D";
      ctx.fillRect(trackR - KERB_W, ky + kerbSize, KERB_W, kerbSize);
    }

    // --- ASPHALT (between kerbs) ---
    const asphaltL = trackL + KERB_W;
    const asphaltR = trackR - KERB_W;
    const asphaltW = asphaltR - asphaltL;

    const asphaltCanvas = asphaltCanvasRef.current;
    if (asphaltCanvas) {
      const offsetY = Math.floor(s.laneOffset) % 40;
      ctx.drawImage(
        asphaltCanvas,
        asphaltL, offsetY, asphaltW, s.h,
        asphaltL, 0, asphaltW, s.h,
      );
    } else {
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(asphaltL, 0, asphaltW, s.h);
    }

    // --- LANE MARKINGS (scrolling downward) ---
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([20, 30]);
    const laneCount = 4;
    for (let i = 1; i < laneCount; i++) {
      const lx = asphaltL + (asphaltW / laneCount) * i;
      ctx.lineDashOffset = -s.laneOffset * 2;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, s.h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // --- SPEED LINES (vertical, batch draw) ---
    const speedAlpha = Math.min(0.25, (s.speed - INITIAL_SPEED) * 0.04);
    if (speedAlpha > 0.01) {
      ctx.strokeStyle = `rgba(255,255,255,${speedAlpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const sl of s.speedLines) {
        ctx.moveTo(sl.x, sl.y);
        ctx.lineTo(sl.x, sl.y + sl.len);
      }
      ctx.stroke();
    }

    // --- RACING LINE ---
    if (showRacingLine) {
      const racingLinePoints = computeRacingLine(s);
      drawRacingLine(ctx, racingLinePoints);
    }

    // --- BARRIERS ---
    for (const b of s.barriers) {
      const distFromTop = b.y;
      const fadeAlpha = distFromTop < BARRIER_FADE_DISTANCE
        ? Math.max(0, distFromTop / BARRIER_FADE_DISTANCE)
        : 1;

      ctx.save();
      ctx.globalAlpha = fadeAlpha;

      // Left wall
      ctx.fillStyle = b.color;
      ctx.fillRect(asphaltL, b.y, b.gapX - asphaltL, b.height);
      // Right wall
      ctx.fillRect(b.gapX + b.gapW, b.y, asphaltR - b.gapX - b.gapW, b.height);

      // Edge highlights on gap
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(b.gapX - 3, b.y, 3, b.height);
      ctx.fillRect(b.gapX + b.gapW, b.y, 3, b.height);

      // Checkered flag pattern on gap edges
      const flagSize = 4;
      for (let fy = 0; fy < b.height; fy += flagSize * 2) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(b.gapX - flagSize, b.y + fy, flagSize, flagSize);
        ctx.fillRect(b.gapX + b.gapW, b.y + fy + flagSize, flagSize, flagSize);
        ctx.fillStyle = "#000";
        ctx.fillRect(b.gapX - flagSize, b.y + fy + flagSize, flagSize, flagSize);
        ctx.fillRect(b.gapX + b.gapW, b.y + fy, flagSize, flagSize);
      }

      // Race name label (horizontal on left wall if wide enough)
      const leftWallW = b.gapX - asphaltL;
      if (leftWallW > 40) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          b.raceName.toUpperCase(),
          asphaltL + leftWallW / 2,
          b.y + b.height / 2,
        );
      }
      // Right wall label
      const rightWallW = asphaltR - b.gapX - b.gapW;
      if (rightWallW > 40) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          b.raceName.toUpperCase(),
          b.gapX + b.gapW + rightWallW / 2,
          b.y + b.height / 2,
        );
      }

      ctx.restore();
    }

    // --- EXHAUST PARTICLES ---
    ctx.save();
    for (const p of s.particles) {
      const lifeRatio = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = lifeRatio * lifeRatio;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // --- CAR ---
    const carY = s.h * CAR_Y_RATIO;
    drawCar(ctx, s.carX, carY);

    // --- HUD ---
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${s.score}m`, 12, 28);

    const speedPct = ((s.speed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED)) * 100;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "11px monospace";
    ctx.fillText(`SPD ${Math.round(speedPct)}%`, 12, 46);

    if (s.bestScore > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`BEST: ${s.bestScore}m`, s.w - 12, 28);
    }

    // Speed indicator bar (right side)
    const barH = 80;
    const barW = 4;
    const barX = s.w - 16;
    const barY = 40;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(barX, barY, barW, barH);
    const fill = (s.speed - INITIAL_SPEED) / (MAX_SPEED - INITIAL_SPEED);
    const fillH = barH * Math.min(1, fill);
    ctx.fillStyle = fill > 0.7 ? "#E8002D" : fill > 0.4 ? "#FF8000" : "#27F4D2";
    ctx.fillRect(barX, barY + barH - fillH, barW, fillH);
  }, [getTrackLeft, getTrackRight]);

  const gameLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    if (!s.running) return;

    // Delta-time
    const rawDt = s.lastFrameTime === 0 ? TARGET_DT : timestamp - s.lastFrameTime;
    s.lastFrameTime = timestamp;
    const dt = Math.min(rawDt, TARGET_DT * 3);
    const dtFactor = dt / TARGET_DT;

    const trackL = getTrackLeft(s.w);
    const trackR = getTrackRight(s.w);

    // --- STEERING PHYSICS ---
    if (s.steerDir !== 0) {
      // Accelerate toward steer direction
      const targetVX = s.steerDir * MAX_STEER_VEL;
      const smoothF = Math.pow(STEER_SMOOTHING, dtFactor);
      s.carVX = s.carVX * smoothF + targetVX * (1 - smoothF);
    } else {
      // Decelerate (drift toward center slightly)
      const trackCenter = (trackL + trackR) / 2;
      const centerPull = (trackCenter - s.carX) * 0.002 * dtFactor;
      s.carVX *= Math.pow(1 - STEER_DECEL, dtFactor);
      s.carVX += centerPull;
    }

    s.carVX = Math.max(-MAX_STEER_VEL, Math.min(MAX_STEER_VEL, s.carVX));
    s.carX += s.carVX * dtFactor;

    // --- DIFFICULTY RAMP ---
    s.distance += s.speed * dtFactor;
    s.speed = Math.min(MAX_SPEED, INITIAL_SPEED + s.distance * 0.0003);
    s.gapSize = Math.max(MIN_GAP_W, INITIAL_GAP_W - s.distance * 0.008);
    s.score = Math.floor(s.distance / 10);

    // --- MOVE BARRIERS downward ---
    const barrierMove = s.speed * dtFactor;
    for (const b of s.barriers) { b.y += barrierMove; }
    s.barriers = s.barriers.filter(b => b.y < s.h + 20);

    // --- SPAWN BARRIERS from top ---
    const firstBarrier = s.barriers.length > 0
      ? s.barriers.reduce((min, b) => b.y < min.y ? b : min, s.barriers[0])
      : null;

    const spawnY = firstBarrier ? firstBarrier.y - BARRIER_SPACING : -50;
    if (!firstBarrier || firstBarrier.y > BARRIER_SPACING - 50) {
      const asphaltL = trackL + KERB_W;
      const asphaltR = trackR - KERB_W;
      const asphaltW = asphaltR - asphaltL;
      const margin = 10;
      const maxGapX = asphaltR - s.gapSize - margin;
      const gapX = asphaltL + margin + Math.random() * Math.max(0, maxGapX - asphaltL - margin);
      const team = TEAM_PALETTE[Math.floor(Math.random() * TEAM_PALETTE.length)];
      const raceName = RACE_NAMES[s.raceIndex % RACE_NAMES.length];
      s.raceIndex++;

      // Clamp gap within track
      const clampedGapX = Math.max(asphaltL + margin, Math.min(gapX, asphaltR - s.gapSize - margin));
      const clampedGapW = Math.min(s.gapSize, asphaltW - margin * 2);

      s.barriers.push({
        y: Math.min(spawnY, -30),
        gapX: clampedGapX,
        gapW: clampedGapW,
        color: team.color,
        label: team.label,
        raceName,
        height: BARRIER_HEIGHT,
        scored: false,
      });
    }

    // --- EXHAUST PARTICLES (spawn behind/below car) ---
    const carY = s.h * CAR_Y_RATIO;
    if (Math.random() < PARTICLE_SPAWN_RATE * dtFactor) {
      const isSpark = Math.random() < 0.3;
      const life = isSpark ? 10 + Math.random() * 15 : 15 + Math.random() * 20;
      s.particles.push({
        x: s.carX + (Math.random() - 0.5) * 6,
        y: carY + CAR_H / 2 + 5,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 1 + Math.random() * 2,
        life, maxLife: life,
        size: isSpark ? 1.5 + Math.random() * 2 : 2 + Math.random() * 3,
        color: isSpark ? "#FFD700" : "#E8002D",
      });
    }
    for (const p of s.particles) {
      p.x += p.vx * dtFactor;
      p.y += p.vy * dtFactor;
      p.life -= dtFactor;
    }
    s.particles = s.particles.filter(p => p.life > 0);

    // --- SPEED LINES (vertical, scrolling down) ---
    const asphaltL2 = trackL + KERB_W;
    const asphaltR2 = trackR - KERB_W;
    for (const sl of s.speedLines) {
      sl.y += sl.speed * (s.speed / INITIAL_SPEED) * dtFactor;
      if (sl.y > s.h + sl.len) {
        sl.y = -sl.len - Math.random() * 50;
        sl.x = asphaltL2 + Math.random() * (asphaltR2 - asphaltL2);
      }
    }
    s.laneOffset = (s.laneOffset + s.speed * 0.8 * dtFactor) % 40;

    // --- COLLISION: track edges (kerb inner edge) ---
    const carLeft = s.carX - CAR_W / 2 - 2; // small margin for wheels
    const carRight = s.carX + CAR_W / 2 + 2;
    const wallL = trackL + KERB_W;
    const wallR = trackR - KERB_W;

    if (carLeft < wallL || carRight > wallR) {
      s.shakeUntil = performance.now() + SHAKE_DURATION;
      endGameRef.current();
      return;
    }

    // --- COLLISION: barriers ---
    const carTop = carY - CAR_H / 2;
    const carBot = carY + CAR_H / 2;

    for (const b of s.barriers) {
      if (carBot > b.y && carTop < b.y + b.height) {
        // Car overlaps barrier Y range. Check if inside gap
        if (carLeft < b.gapX || carRight > b.gapX + b.gapW) {
          s.shakeUntil = performance.now() + SHAKE_DURATION;
          endGameRef.current();
          return;
        }
      }
      if (!b.scored && b.y > carBot) { b.scored = true; }
    }

    // --- RENDER ---
    const now = performance.now();
    if (now < s.shakeUntil) {
      const progress = 1 - (s.shakeUntil - now) / SHAKE_DURATION;
      const decay = 1 - progress;
      s.shakeOffsetX = (Math.random() - 0.5) * 2 * SHAKE_INTENSITY * decay;
      s.shakeOffsetY = (Math.random() - 0.5) * 2 * SHAKE_INTENSITY * decay;
    } else {
      s.shakeOffsetX = 0;
      s.shakeOffsetY = 0;
    }

    ctx.save();
    ctx.translate(s.shakeOffsetX, s.shakeOffsetY);
    renderFrame(ctx, s, true);
    ctx.restore();

    setDisplayScore(s.score);
    animRef.current = requestAnimationFrame(gameLoop);
  }, [getTrackLeft, getTrackRight, renderFrame]);

  const endGame = useCallback(() => {
    const s = stateRef.current;
    s.running = false;
    s.gameOver = true;
    if (s.score > s.bestScore) { s.bestScore = s.score; setBestScore(s.score); }
    setDisplayScore(s.score);
    setGameOver(true);

    const shakeEnd = s.shakeUntil;
    const shakeLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const now = performance.now();
      if (now >= shakeEnd) {
        s.shakeOffsetX = 0;
        s.shakeOffsetY = 0;
        renderFrame(ctx, s, false);
        return;
      }
      const progress = 1 - (shakeEnd - now) / SHAKE_DURATION;
      const decay = 1 - progress;
      s.shakeOffsetX = (Math.random() - 0.5) * 2 * SHAKE_INTENSITY * decay;
      s.shakeOffsetY = (Math.random() - 0.5) * 2 * SHAKE_INTENSITY * decay;
      ctx.save();
      ctx.translate(s.shakeOffsetX, s.shakeOffsetY);
      renderFrame(ctx, s, false);
      ctx.restore();
      requestAnimationFrame(shakeLoop);
    };

    if (shakeEnd > performance.now()) {
      requestAnimationFrame(shakeLoop);
    }

    cancelAnimationFrame(animRef.current);
    if (session?.user?.id && s.score > 0) {
      setScoreSaved(false);
      fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: s.score }),
      })
        .then(r => { if (r.ok) setScoreSaved(true); return fetchLeaderboard(); })
        .catch(() => {});
    } else { fetchLeaderboard(); }
  }, [session, fetchLeaderboard, renderFrame]);

  useEffect(() => { endGameRef.current = endGame; }, [endGame]);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    const trackL = getTrackLeft(s.w);
    const trackR = getTrackRight(s.w);

    s.running = true;
    s.gameOver = false;
    s.score = 0;
    s.carX = (trackL + trackR) / 2;
    s.carVX = 0;
    s.steerDir = 0;
    s.barriers = [];
    s.particles = [];
    s.speed = INITIAL_SPEED;
    s.gapSize = INITIAL_GAP_W;
    s.distance = 0;
    s.laneOffset = 0;
    s.raceIndex = Math.floor(Math.random() * RACE_NAMES.length);
    s.lastFrameTime = 0;
    s.shakeUntil = 0;
    s.shakeOffsetX = 0;
    s.shakeOffsetY = 0;
    s.touchId = null;

    setGameOver(false);
    setStarted(true);
    setScoreSaved(false);
    initSpeedLines();
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop, initSpeedLines, getTrackLeft, getTrackRight]);

  // --- KEYBOARD INPUT ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (!stateRef.current.running) { startGame(); }
        return;
      }
      if (e.code === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        stateRef.current.steerDir = -1;
      }
      if (e.code === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        stateRef.current.steerDir = 1;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft" || e.key === "a" || e.key === "A") {
        if (stateRef.current.steerDir === -1) stateRef.current.steerDir = 0;
      }
      if (e.code === "ArrowRight" || e.key === "d" || e.key === "D") {
        if (stateRef.current.steerDir === 1) stateRef.current.steerDir = 0;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startGame]);

  // --- TOUCH / POINTER INPUT ---
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (!stateRef.current.running) { startGame(); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const mid = rect.width / 2;

    stateRef.current.touchId = e.pointerId;
    stateRef.current.touchStartX = e.clientX;

    if (x < mid) {
      stateRef.current.steerDir = -1;
    } else {
      stateRef.current.steerDir = 1;
    }
  }, [startGame]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (stateRef.current.touchId !== e.pointerId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const mid = rect.width / 2;

    if (x < mid) {
      stateRef.current.steerDir = -1;
    } else {
      stateRef.current.steerDir = 1;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (stateRef.current.touchId === e.pointerId) {
      stateRef.current.steerDir = 0;
      stateRef.current.touchId = null;
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    stateRef.current.steerDir = 0;
    stateRef.current.touchId = null;
  }, []);

  useEffect(() => { return () => cancelAnimationFrame(animRef.current); }, []);

  // --- INITIAL DRAW ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    const trackL = getTrackLeft(s.w);
    const trackR = getTrackRight(s.w);
    s.carX = (trackL + trackR) / 2;

    renderFrame(ctx, s, false);
  }, [getTrackLeft, getTrackRight, renderFrame]);

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className="relative w-full rounded-lg overflow-hidden border border-zinc-800 select-none touch-none"
      >
        <canvas
          ref={canvasRef}
          className="block w-full"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={e => e.preventDefault()}
        />

        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <h2 className="text-3xl font-bold mb-2">
              <span className="text-red-500">F1</span> Dodge
            </h2>
            <p className="text-zinc-400 text-sm mb-6 text-center px-4">
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs mx-1">&larr;</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs mx-1">&rarr;</kbd>
              {" "}or{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs mx-1">A</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs mx-1">D</kbd>
              {" "}to steer. Tap left/right on mobile.
            </p>
            <button
              onClick={startGame}
              className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
            >
              Start
            </button>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <h2 className="text-2xl font-bold mb-1 text-red-500">Race Over</h2>
            <p className="text-4xl font-bold mb-1">{displayScore}m</p>
            {bestScore > 0 && bestScore > displayScore && (
              <p className="text-zinc-500 text-sm mb-2">Best: {bestScore}m</p>
            )}
            {bestScore > 0 && bestScore === displayScore && (
              <p className="text-amber-400 text-sm mb-2 font-semibold">
                New personal best!
              </p>
            )}
            {scoreSaved && (
              <p className="text-green-400 text-xs mb-2">
                Score saved to leaderboard
              </p>
            )}
            {!session && (
              <p className="text-zinc-500 text-xs mb-2">
                Sign in to save your scores
              </p>
            )}
            <button
              onClick={startGame}
              className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors mt-2"
            >
              Restart
            </button>
            <p className="text-zinc-600 text-xs mt-3">
              Press{" "}
              <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-xs">
                Space
              </kbd>{" "}
              to restart
            </p>
          </div>
        )}
      </div>

      {leaderboard.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="font-semibold text-sm text-zinc-400 mb-3 uppercase tracking-wide">
            Top Scores
          </h3>
          <div className="space-y-1.5">
            {leaderboard.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 text-right font-mono ${
                      i === 0
                        ? "text-amber-400"
                        : i === 1
                          ? "text-zinc-300"
                          : i === 2
                            ? "text-amber-700"
                            : "text-zinc-500"
                    }`}
                  >
                    {i + 1}.
                  </span>
                  <span className="text-zinc-200">{entry.playerName}</span>
                </div>
                <span className="font-mono text-zinc-400">
                  {entry.score.toLocaleString()}m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
