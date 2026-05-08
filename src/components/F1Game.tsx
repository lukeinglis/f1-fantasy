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

interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; }
interface Barrier { x: number; gapY: number; gapH: number; color: string; label: string; raceName: string; width: number; scored: boolean; }
interface SpeedLine { x: number; y: number; len: number; speed: number; }
interface RacingLinePoint { x: number; y: number; }
interface LeaderboardEntry { id: string; playerName: string; score: number; createdAt: string; }

const CAR_X_RATIO = 0.15;
const CAR_W = 70;
const CAR_H = 18;
const GRAVITY = 0.35;
const LIFT = -0.55;
const MAX_VEL = 7;
const BARRIER_WIDTH = 55;
const INITIAL_GAP = 200;
const MIN_GAP = 90;
const INITIAL_SPEED = 3;
const MAX_SPEED = 9;
const BARRIER_SPACING = 280;
const PARTICLE_SPAWN_RATE = 0.6;
const SPEED_LINE_COUNT = 15;

export default function F1Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();

  const stateRef = useRef({
    running: false, gameOver: false, score: 0,
    carY: 0, carVY: 0,
    barriers: [] as Barrier[], particles: [] as Particle[],
    speedLines: [] as SpeedLine[], racingLine: [] as RacingLinePoint[],
    pressing: false, speed: INITIAL_SPEED, gapSize: INITIAL_GAP,
    distance: 0, w: 800, h: 500, gridOffset: 0, bestScore: 0,
    raceIndex: 0,
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

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.min(Math.floor(rect.width * 0.55), 500);
    canvas.width = w;
    canvas.height = h;
    stateRef.current.w = w;
    stateRef.current.h = h;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  const initSpeedLines = useCallback(() => {
    const s = stateRef.current;
    s.speedLines = [];
    for (let i = 0; i < SPEED_LINE_COUNT; i++) {
      s.speedLines.push({ x: Math.random() * s.w, y: Math.random() * s.h, len: 20 + Math.random() * 40, speed: 2 + Math.random() * 4 });
    }
  }, []);

  function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    const w = CAR_W;
    const h = CAR_H;

    // Rear wing (vertical plate)
    ctx.fillStyle = "#cc0022";
    ctx.fillRect(w * 0.92, h * -0.15, 3, h * 0.3);
    ctx.fillRect(w * 0.92, h * 0.85, 3, h * 0.3);
    // Rear wing endplates
    ctx.fillStyle = "#E8002D";
    ctx.fillRect(w * 0.88, h * -0.2, w * 0.12, 3);
    ctx.fillRect(w * 0.88, h * 1.17, w * 0.12, 3);

    // Engine cover / airbox (raised section behind cockpit)
    ctx.fillStyle = "#b0001f";
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h * 0.2);
    ctx.lineTo(w * 0.58, h * -0.05);
    ctx.lineTo(w * 0.62, h * -0.05);
    ctx.lineTo(w * 0.65, h * 0.15);
    ctx.lineTo(w * 0.88, h * 0.25);
    ctx.lineTo(w * 0.88, h * 0.75);
    ctx.lineTo(w * 0.65, h * 0.85);
    ctx.lineTo(w * 0.62, h * 1.05);
    ctx.lineTo(w * 0.58, h * 1.05);
    ctx.lineTo(w * 0.55, h * 0.8);
    ctx.closePath();
    ctx.fill();

    // Main body (sidepods + nose)
    ctx.fillStyle = "#E8002D";
    ctx.beginPath();
    ctx.moveTo(0, h * 0.4);
    ctx.lineTo(w * 0.08, h * 0.25);
    ctx.lineTo(w * 0.2, h * 0.15);
    ctx.lineTo(w * 0.35, h * 0.12);
    ctx.lineTo(w * 0.5, h * 0.18);
    ctx.lineTo(w * 0.65, h * 0.22);
    ctx.lineTo(w * 0.85, h * 0.3);
    ctx.lineTo(w * 0.92, h * 0.35);
    ctx.lineTo(w * 0.92, h * 0.65);
    ctx.lineTo(w * 0.85, h * 0.7);
    ctx.lineTo(w * 0.65, h * 0.78);
    ctx.lineTo(w * 0.5, h * 0.82);
    ctx.lineTo(w * 0.35, h * 0.88);
    ctx.lineTo(w * 0.2, h * 0.85);
    ctx.lineTo(w * 0.08, h * 0.75);
    ctx.lineTo(0, h * 0.6);
    ctx.closePath();
    ctx.fill();

    // Nose cone tip
    ctx.fillStyle = "#ff1a3a";
    ctx.beginPath();
    ctx.moveTo(-w * 0.04, h * 0.45);
    ctx.lineTo(0, h * 0.38);
    ctx.lineTo(w * 0.06, h * 0.35);
    ctx.lineTo(w * 0.06, h * 0.65);
    ctx.lineTo(0, h * 0.62);
    ctx.lineTo(-w * 0.04, h * 0.55);
    ctx.closePath();
    ctx.fill();

    // Cockpit opening
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.ellipse(w * 0.47, h * 0.5, w * 0.06, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Halo (T-bar shape)
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.32);
    ctx.quadraticCurveTo(w * 0.42, h * 0.15, w * 0.52, h * 0.22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.68);
    ctx.quadraticCurveTo(w * 0.42, h * 0.85, w * 0.52, h * 0.78);
    ctx.stroke();

    // Driver helmet
    ctx.fillStyle = "#E8002D";
    ctx.beginPath();
    ctx.arc(w * 0.46, h * 0.5, h * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(w * 0.45, h * 0.48, h * 0.04, 0, Math.PI * 2);
    ctx.fill();

    // Front wing elements
    ctx.fillStyle = "#cc0022";
    ctx.fillRect(-w * 0.02, h * 0.05, w * 0.15, 2.5);
    ctx.fillRect(-w * 0.02, h * 0.93, w * 0.15, 2.5);
    ctx.fillStyle = "#E8002D";
    ctx.fillRect(-w * 0.04, h * -0.02, w * 0.12, 2);
    ctx.fillRect(-w * 0.04, h * 1.0, w * 0.12, 2);

    // Front wheels
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.ellipse(w * 0.14, h * -0.08, w * 0.05, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.14, h * 1.08, w * 0.05, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wheel rims
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(w * 0.14, h * -0.08, w * 0.025, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.14, h * 1.08, w * 0.025, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rear wheels
    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.ellipse(w * 0.78, h * -0.06, w * 0.055, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.78, h * 1.06, w * 0.055, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(w * 0.78, h * -0.06, w * 0.028, h * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w * 0.78, h * 1.06, w * 0.028, h * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();

    // White number on sidepod
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `bold ${Math.round(h * 0.45)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("1", w * 0.65, h * 0.52);

    ctx.restore();
  }

  // Compute the optimal racing line through upcoming barriers
  function computeRacingLine(s: typeof stateRef.current): RacingLinePoint[] {
    const points: RacingLinePoint[] = [];
    const carX = s.w * CAR_X_RATIO + CAR_W / 2;

    // Start from car position
    points.push({ x: carX, y: s.carY + CAR_H / 2 });

    // Add points through each barrier gap center
    const visibleBarriers = s.barriers
      .filter(b => b.x > carX - 50)
      .sort((a, b) => a.x - b.x);

    for (const b of visibleBarriers) {
      const gapCenterY = b.gapY + b.gapH / 2;
      // Add a lead-in point before the barrier
      points.push({ x: b.x - 30, y: gapCenterY });
      // Center of gap
      points.push({ x: b.x + b.width / 2, y: gapCenterY });
    }

    // Extend to the right edge
    if (points.length > 0) {
      const last = points[points.length - 1];
      points.push({ x: s.w + 50, y: last.y });
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
      const cpx = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x + (cpx - prev.x) * 0.5, prev.y, cpx, (prev.y + curr.y) / 2);
      ctx.quadraticCurveTo(curr.x - (curr.x - cpx) * 0.5, curr.y, curr.x, curr.y);
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    if (!s.running) return;

    // Physics
    if (s.pressing) { s.carVY += LIFT; } else { s.carVY += GRAVITY; }
    s.carVY = Math.max(-MAX_VEL, Math.min(MAX_VEL, s.carVY));
    s.carY += s.carVY;

    // Ramp difficulty
    s.distance += s.speed;
    s.speed = Math.min(MAX_SPEED, INITIAL_SPEED + s.distance * 0.0003);
    s.gapSize = Math.max(MIN_GAP, INITIAL_GAP - s.distance * 0.012);
    s.score = Math.floor(s.distance / 10);

    // Move barriers
    for (const b of s.barriers) { b.x -= s.speed; }
    s.barriers = s.barriers.filter(b => b.x + b.width > -10);

    // Spawn barriers
    const lastBarrier = s.barriers[s.barriers.length - 1];
    const spawnX = lastBarrier ? lastBarrier.x + BARRIER_SPACING : s.w + 100;
    if (!lastBarrier || lastBarrier.x < s.w - BARRIER_SPACING + 50) {
      const margin = 40;
      const gapY = margin + Math.random() * (s.h - s.gapSize - margin * 2);
      const team = TEAM_PALETTE[Math.floor(Math.random() * TEAM_PALETTE.length)];
      const raceName = RACE_NAMES[s.raceIndex % RACE_NAMES.length];
      s.raceIndex++;
      s.barriers.push({
        x: Math.max(spawnX, s.w + 50), gapY, gapH: s.gapSize,
        color: team.color, label: team.label, raceName,
        width: BARRIER_WIDTH, scored: false,
      });
    }

    // Particles
    const carX = s.w * CAR_X_RATIO;
    if (Math.random() < PARTICLE_SPAWN_RATE) {
      const isSpark = Math.random() < 0.3;
      s.particles.push({
        x: carX + CAR_W * 0.95, y: s.carY + CAR_H * 0.3 + Math.random() * CAR_H * 0.4,
        vx: 1 + Math.random() * 2, vy: (Math.random() - 0.5) * 1.5,
        life: isSpark ? 10 + Math.random() * 15 : 15 + Math.random() * 20,
        maxLife: 0, size: isSpark ? 1.5 + Math.random() * 2 : 2 + Math.random() * 3,
        color: isSpark ? "#FFD700" : "#E8002D",
      });
      s.particles[s.particles.length - 1].maxLife = s.particles[s.particles.length - 1].life;
    }
    for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.life--; }
    s.particles = s.particles.filter(p => p.life > 0);

    // Speed lines
    for (const sl of s.speedLines) {
      sl.x -= sl.speed * (s.speed / INITIAL_SPEED);
      if (sl.x + sl.len < 0) { sl.x = s.w + Math.random() * 100; sl.y = Math.random() * s.h; }
    }
    s.gridOffset = (s.gridOffset + s.speed * 0.5) % 40;

    // Collision: ceiling/floor
    if (s.carY < 0 || s.carY + CAR_H > s.h) { endGameRef.current(); return; }

    // Collision: barriers
    for (const b of s.barriers) {
      const carRight = carX + CAR_W;
      const carBottom = s.carY + CAR_H;
      if (carRight > b.x && carX < b.x + b.width) {
        if (s.carY < b.gapY || carBottom > b.gapY + b.gapH) { endGameRef.current(); return; }
      }
      if (!b.scored && b.x + b.width < carX) { b.scored = true; }
    }

    // RENDER
    ctx.clearRect(0, 0, s.w, s.h);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, s.w, s.h);

    // Scrolling grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let gx = -s.gridOffset; gx < s.w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, s.h); ctx.stroke(); }
    for (let gy = 0; gy < s.h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(s.w, gy); ctx.stroke(); }

    // Speed lines
    const speedAlpha = Math.min(0.35, (s.speed - INITIAL_SPEED) * 0.06);
    if (speedAlpha > 0.01) {
      ctx.strokeStyle = `rgba(255,255,255,${speedAlpha})`;
      ctx.lineWidth = 1;
      for (const sl of s.speedLines) { ctx.beginPath(); ctx.moveTo(sl.x, sl.y); ctx.lineTo(sl.x + sl.len, sl.y); ctx.stroke(); }
    }

    // Racing line (optimal path)
    const racingLinePoints = computeRacingLine(s);
    drawRacingLine(ctx, racingLinePoints);

    // Barriers with race names
    for (const b of s.barriers) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, 0, b.width, b.gapY);
      ctx.fillRect(b.x, b.gapY + b.gapH, b.width, s.h - b.gapY - b.gapH);

      // Edge highlights
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(b.x, b.gapY - 3, b.width, 3);
      ctx.fillRect(b.x, b.gapY + b.gapH, b.width, 3);

      // Race name (vertical on the barrier)
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      // Top barrier label
      if (b.gapY > 50) {
        ctx.save();
        ctx.translate(b.x + b.width / 2, b.gapY - 15);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(b.raceName.toUpperCase(), 0, 0);
        ctx.restore();
      }
      // Bottom barrier label
      if (s.h - b.gapY - b.gapH > 50) {
        ctx.save();
        ctx.translate(b.x + b.width / 2, b.gapY + b.gapH + 15);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(b.raceName.toUpperCase(), 0, 0);
        ctx.restore();
      }

      // Checkered flag pattern on gap edges
      const flagSize = 4;
      for (let fx = 0; fx < b.width; fx += flagSize * 2) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(b.x + fx, b.gapY - flagSize, flagSize, flagSize);
        ctx.fillRect(b.x + fx + flagSize, b.gapY + b.gapH, flagSize, flagSize);
        ctx.fillStyle = "#000";
        ctx.fillRect(b.x + fx + flagSize, b.gapY - flagSize, flagSize, flagSize);
        ctx.fillRect(b.x + fx, b.gapY + b.gapH, flagSize, flagSize);
      }

      ctx.restore();
    }

    // Particles
    for (const p of s.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Track boundaries (red/white kerb pattern)
    const kerbSize = 12;
    for (let kx = -s.gridOffset; kx < s.w; kx += kerbSize * 2) {
      ctx.fillStyle = "#E8002D";
      ctx.fillRect(kx, 0, kerbSize, 4);
      ctx.fillRect(kx + kerbSize, s.h - 4, kerbSize, 4);
      ctx.fillStyle = "#fff";
      ctx.fillRect(kx + kerbSize, 0, kerbSize, 4);
      ctx.fillRect(kx, s.h - 4, kerbSize, 4);
    }

    // Car
    drawCar(ctx, carX, s.carY);

    // HUD
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

    setDisplayScore(s.score);
    animRef.current = requestAnimationFrame(gameLoop);
  }, []);

  const endGame = useCallback(() => {
    const s = stateRef.current;
    s.running = false;
    s.gameOver = true;
    if (s.score > s.bestScore) { s.bestScore = s.score; setBestScore(s.score); }
    setDisplayScore(s.score);
    setGameOver(true);
    cancelAnimationFrame(animRef.current);
    if (session?.user?.id && s.score > 0) {
      setScoreSaved(false);
      fetch("/api/game", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: s.score }) })
        .then(r => { if (r.ok) setScoreSaved(true); return fetchLeaderboard(); })
        .catch(() => {});
    } else { fetchLeaderboard(); }
  }, [session, fetchLeaderboard]);

  useEffect(() => { endGameRef.current = endGame; }, [endGame]);

  const startGame = useCallback(() => {
    const s = stateRef.current;
    s.running = true; s.gameOver = false; s.score = 0;
    s.carY = s.h / 2 - CAR_H / 2; s.carVY = 0;
    s.barriers = []; s.particles = []; s.racingLine = [];
    s.speed = INITIAL_SPEED; s.gapSize = INITIAL_GAP;
    s.distance = 0; s.gridOffset = 0; s.pressing = false;
    s.raceIndex = Math.floor(Math.random() * RACE_NAMES.length);
    setGameOver(false); setStarted(true); setScoreSaved(false);
    initSpeedLines();
    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop, initSpeedLines]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (!stateRef.current.running) { startGame(); return; }
        stateRef.current.pressing = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { if (e.code === "Space" || e.key === " ") stateRef.current.pressing = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [startGame]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (!stateRef.current.running) { startGame(); return; }
    stateRef.current.pressing = true;
  }, [startGame]);
  const handlePointerUp = useCallback(() => { stateRef.current.pressing = false; }, []);

  useEffect(() => { return () => cancelAnimationFrame(animRef.current); }, []);

  // Initial draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, s.w, s.h);
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < s.w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, s.h); ctx.stroke(); }
    for (let gy = 0; gy < s.h; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(s.w, gy); ctx.stroke(); }
    const kerbSize = 12;
    for (let kx = 0; kx < s.w; kx += kerbSize * 2) {
      ctx.fillStyle = "#E8002D"; ctx.fillRect(kx, 0, kerbSize, 4); ctx.fillRect(kx + kerbSize, s.h - 4, kerbSize, 4);
      ctx.fillStyle = "#fff"; ctx.fillRect(kx + kerbSize, 0, kerbSize, 4); ctx.fillRect(kx, s.h - 4, kerbSize, 4);
    }
    drawCar(ctx, s.w * CAR_X_RATIO, s.h / 2 - CAR_H / 2);
  }, []);

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="relative w-full rounded-lg overflow-hidden border border-zinc-800 select-none touch-none">
        <canvas ref={canvasRef} className="block w-full"
          onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp} onContextMenu={e => e.preventDefault()} />

        {!started && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <h2 className="text-3xl font-bold mb-2"><span className="text-red-500">F1</span> Dodge</h2>
            <p className="text-zinc-400 text-sm mb-6 text-center px-4">
              Hold <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-xs mx-1">Space</kbd> or tap to fly up. Navigate the Grand Prix gates.
            </p>
            <button onClick={startGame} className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors">
              Start
            </button>
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <h2 className="text-2xl font-bold mb-1 text-red-500">Race Over</h2>
            <p className="text-4xl font-bold mb-1">{displayScore}m</p>
            {bestScore > 0 && bestScore > displayScore && <p className="text-zinc-500 text-sm mb-2">Best: {bestScore}m</p>}
            {bestScore > 0 && bestScore === displayScore && <p className="text-amber-400 text-sm mb-2 font-semibold">New personal best!</p>}
            {scoreSaved && <p className="text-green-400 text-xs mb-2">Score saved to leaderboard</p>}
            {!session && <p className="text-zinc-500 text-xs mb-2">Sign in to save your scores</p>}
            <button onClick={startGame} className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors mt-2">
              Restart
            </button>
            <p className="text-zinc-600 text-xs mt-3">Press <kbd className="px-1 py-0.5 rounded bg-zinc-800 text-xs">Space</kbd> to restart</p>
          </div>
        )}
      </div>

      {leaderboard.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="font-semibold text-sm text-zinc-400 mb-3 uppercase tracking-wide">Top Scores</h3>
          <div className="space-y-1.5">
            {leaderboard.map((entry, i) => (
              <div key={entry.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-right font-mono ${i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-700" : "text-zinc-500"}`}>
                    {i + 1}.
                  </span>
                  <span className="text-zinc-200">{entry.playerName}</span>
                </div>
                <span className="font-mono text-zinc-400">{entry.score.toLocaleString()}m</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
