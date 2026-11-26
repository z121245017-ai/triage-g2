import type { TriageSnapshot } from '../glasses/triageController';

const GREEN_PALETTE = ['#031108', '#154727', '#258749', '#38c76c', '#5cff98'];

function greenForLevel(level = 4): string {
  return GREEN_PALETTE[Math.max(0, Math.min(4, Math.round(level)))];
}

function borderGreen(borderColor = 0): string {
  if (borderColor <= 0) return 'transparent';
  const alpha = Math.min(1, borderColor / 15);
  return `rgba(92, 255, 152, ${(0.18 + alpha * 0.65).toFixed(2)})`;
}

let cachedBytes: Uint8Array | null = null;
let cachedImg: HTMLImageElement | null = null;

function loadImage(png: Uint8Array | null, onReady: () => void): HTMLImageElement | null {
  if (!png) {
    cachedBytes = null;
    cachedImg = null;
    return null;
  }
  if (png === cachedBytes && cachedImg) return cachedImg;
  cachedBytes = png;
  const blob = new Blob([png as unknown as BlobPart], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    cachedImg = img;
    onReady();
  };
  img.src = url;
  return cachedImg;
}

export function drawG2EmulatorCanvas(canvas: HTMLCanvasElement, snap: TriageSnapshot): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#020905';
  ctx.fillRect(0, 0, 576, 288);

  ctx.fillStyle = 'rgba(72, 255, 138, 0.025)';
  for (let y = 0; y < 288; y += 3) ctx.fillRect(0, y, 576, 1);

  const page = snap.currentPage;
  if (!page) return;

  const layers: Array<{ z: number; draw: () => void }> = [];

  for (const t of page.textObject) {
    layers.push({
      z: t.zOrderIndex ?? 0,
      draw: () => {
        const x = t.xPosition ?? 0;
        const y = t.yPosition ?? 0;
        const w = t.width ?? 100;
        const h = t.height ?? 30;
        const pad = t.paddingLength ?? 4;

        if ((t.borderWidth ?? 0) > 0 && (t.borderColor ?? 0) > 0) {
          ctx.strokeStyle = borderGreen(t.borderColor);
          ctx.lineWidth = t.borderWidth ?? 1;
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        }

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();

        ctx.fillStyle = greenForLevel(t.textColor ?? 4);
        const isHeader = h <= 36 && y <= 10;
        ctx.font = isHeader
          ? '600 15px ui-monospace, SFMono-Regular, Menlo, monospace'
          : '14px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textBaseline = 'top';
        const lineH = isHeader ? 22 : 24;
        (t.content ?? '').split('\n').forEach((line, idx) => {
          ctx.fillText(line, x + pad, y + pad + idx * lineH);
        });
        ctx.restore();
      },
    });
  }

  for (const l of page.listObject) {
    layers.push({
      z: l.zOrderIndex ?? 0,
      draw: () => {
        const x = l.xPosition ?? 0;
        const y = l.yPosition ?? 0;
        const w = l.width ?? 200;
        const h = l.height ?? 100;
        const pad = l.paddingLength ?? 4;
        const items = l.itemContainer?.itemName ?? [];

        if ((l.borderWidth ?? 0) > 0 && (l.borderColor ?? 0) > 0) {
          ctx.strokeStyle = borderGreen(l.borderColor);
          ctx.lineWidth = l.borderWidth ?? 1;
          ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        }

        const rowH = Math.min(36, Math.max(24, Math.floor((h - pad * 2) / Math.max(1, items.length))));
        items.forEach((label, i) => {
          const ry = y + pad + i * rowH;
          const selected = i === snap.selectedIndex;
          if (selected) {
            ctx.fillStyle = 'rgba(92, 255, 152, 0.16)';
            ctx.fillRect(x + pad, ry + 1, w - pad * 2, rowH - 3);
            ctx.strokeStyle = '#5cff98';
            ctx.lineWidth = 1.25;
            ctx.strokeRect(x + pad + 0.5, ry + 1.5, w - pad * 2 - 1, rowH - 4);
          }
          ctx.fillStyle = selected ? '#5cff98' : '#32b863';
          ctx.font = selected
            ? '600 13px ui-monospace, SFMono-Regular, Menlo, monospace'
            : '13px ui-monospace, SFMono-Regular, Menlo, monospace';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x + pad + 6, ry + rowH / 2);
        });
      },
    });
  }

  for (const im of page.imageObject) {
    layers.push({
      z: im.zOrderIndex ?? 0,
      draw: () => {
        const x = im.xPosition ?? 0;
        const y = im.yPosition ?? 0;
        const w = im.width ?? 100;
        const h = im.height ?? 80;
        const loaded = loadImage(snap.currentImagePng, () => drawG2EmulatorCanvas(canvas, snap));
        if (loaded) {
          const off = document.createElement('canvas');
          off.width = w;
          off.height = h;
          const octx = off.getContext('2d');
          if (octx) {
            octx.drawImage(loaded, 0, 0, w, h);
            const data = octx.getImageData(0, 0, w, h);
            const d = data.data;
            for (let i = 0; i < d.length; i += 4) {
              const g = d[i];
              d[i] = Math.round(g * 0.25);
              d[i + 1] = g;
              d[i + 2] = Math.round(g * 0.45);
              d[i + 3] = 255;
            }
            octx.putImageData(data, 0, 0);
            ctx.drawImage(off, x, y, w, h);
          }
        }
      },
    });
  }

  layers.sort((a, b) => a.z - b.z);
  for (const layer of layers) layer.draw();
}
