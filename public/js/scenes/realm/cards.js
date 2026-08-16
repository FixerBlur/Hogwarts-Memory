import * as THREE from 'three';
import { rand } from '../../core/tween.js';
import { createCanvas, canvasTexture } from '../../core/fx.js';
import { t } from '../../i18n.js';

function parchmentBase(ctx, w, h, { colors, stains, scale = 1 }) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, colors[0]);
  bg.addColorStop(1, colors[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const m = 10 * scale;
  for (let i = 0; i < stains; i++) {
    ctx.fillStyle = `rgba(150, 115, 55, ${rand(0.04, 0.11)})`;
    ctx.beginPath();
    ctx.ellipse(rand(m, w - m), rand(m, h - m),
      rand(8, 26) * scale, rand(6, 18) * scale, rand(0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
}

function waxSeal(ctx, x, y, r) {
  ctx.fillStyle = '#8e2b1d';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a83a28';
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60, 15, 8, 0.7)';
  ctx.lineWidth = Math.max(1.5, r * 0.125);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function parchmentBorder(ctx, w, h, lineWidth, inset) {
  ctx.strokeStyle = 'rgba(110, 80, 40, 0.85)';
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
}

export function letterTexture() {
  const { canvas, ctx } = createCanvas(128, 170);
  parchmentBase(ctx, 128, 170, { colors: ['#e9dfc2', '#d9c9a2'], stains: 4 });
  ctx.strokeStyle = 'rgba(70, 50, 30, 0.65)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  for (let y = 24; y < 128; y += 14) {
    const w = y > 100 ? rand(30, 70) : rand(78, 104);
    ctx.beginPath();
    ctx.moveTo(14, y);
    for (let x = 14; x < 14 + w; x += 7) ctx.lineTo(x, y + rand(-2, 2));
    ctx.stroke();
  }
  waxSeal(ctx, rand(80, 100), rand(138, 152), 11);
  parchmentBorder(ctx, 128, 170, 4, 1);
  return canvasTexture(canvas);
}

export function photoTexture() {
  const { canvas, ctx } = createCanvas(128, 150);
  ctx.fillStyle = '#e3ddcf';
  ctx.fillRect(0, 0, 128, 150);
  const img = ctx.createLinearGradient(0, 10, 0, 122);
  img.addColorStop(0, '#31415c');
  img.addColorStop(1, '#1a2436');
  ctx.fillStyle = img;
  ctx.fillRect(10, 10, 108, 112);
  ctx.fillStyle = 'rgba(190, 210, 235, 0.35)';
  const cx = rand(45, 85);
  ctx.beginPath();
  ctx.ellipse(cx, 62, 11, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, 105, 22, 28, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(220, 235, 255, 0.25)';
  ctx.beginPath();
  ctx.arc(rand(25, 100), rand(22, 40), rand(6, 10), 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90, 70, 45, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 136);
  for (let x = 30; x < 98; x += 7) ctx.lineTo(x, 136 + rand(-1.5, 1.5));
  ctx.stroke();
  return canvasTexture(canvas);
}

export function previewTexture(title, author) {
  const { canvas, ctx } = createCanvas(256, 340);
  parchmentBase(ctx, 256, 340, { colors: ['#ecdfc0', '#d9c69e'], stains: 5, scale: 2 });

  ctx.fillStyle = '#3a2a16';
  ctx.font = 'italic 26px Georgia, serif';
  ctx.textAlign = 'center';
  const words = title.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > 208 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
    if (lines.length === 4) break;
  }
  if (lines.length < 4 && line) lines.push(line);
  const startY = 96 - (lines.length - 1) * 17;
  lines.forEach((l, i) => ctx.fillText(l, 128, startY + i * 34));

  ctx.strokeStyle = 'rgba(110, 80, 40, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(52, 170);
  ctx.lineTo(204, 170);
  ctx.stroke();

  ctx.font = '19px Georgia, serif';
  ctx.fillStyle = 'rgba(90, 62, 30, 0.85)';
  ctx.fillText(t('card.label'), 128, 205);
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillStyle = '#4a3418';
  ctx.fillText(author, 128, 236);

  waxSeal(ctx, 190, 292, 20);
  parchmentBorder(ctx, 256, 340, 6, 2);
  return canvasTexture(canvas);
}

export function cardGeometry(w, h) {
  const geo = new THREE.PlaneGeometry(w, h, 6, 6);
  const pos = geo.attributes.position;
  const bend = rand(0.05, 0.12);
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, Math.sin(pos.getX(i) * 4) * bend);
  }
  geo.computeVertexNormals();
  return geo;
}
