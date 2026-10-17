import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atelier QR — Créateur de QR codes à imprimer" },
      { name: "description", content: "Créez des QR codes personnalisés (liens, texte, logo) et exportez une planche PDF de 32 exemplaires." },
      { property: "og:title", content: "Atelier QR — Créateur de QR codes" },
      { property: "og:description", content: "QR codes personnalisés et planche PDF de 32 exemplaires." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type DotType = "square" | "dots" | "rounded" | "classy" | "classy-rounded" | "extra-rounded";
type CornerType = "square" | "dot" | "extra-rounded";
type Frame = "none" | "simple" | "arrondi" | "etiquette";

const PALETTES = [
  { name: "Encre", fg: "#111111", bg: "#ffffff" },
  { name: "Forêt", fg: "#1f4d3a", bg: "#f7f3e8" },
  { name: "Brique", fg: "#b4441f", bg: "#fff8f0" },
  { name: "Nuit", fg: "#1b2a4e", bg: "#ffffff" },
  { name: "Prune", fg: "#6b2152", bg: "#fdf4f8" },
  { name: "Inversé", fg: "#ffffff", bg: "#111111" },
];
const DOTS: { v: DotType; l: string }[] = [
  { v: "square", l: "Carré" }, { v: "dots", l: "Points" }, { v: "rounded", l: "Arrondi" },
  { v: "extra-rounded", l: "Très arrondi" }, { v: "classy", l: "Élégant" }, { v: "classy-rounded", l: "Élégant doux" },
];
const CORNERS: { v: CornerType; l: string }[] = [
  { v: "square", l: "Carré" }, { v: "extra-rounded", l: "Arrondi" }, { v: "dot", l: "Rond" },
];
const FRAMES: { v: Frame; l: string }[] = [
  { v: "none", l: "Aucun" }, { v: "simple", l: "Bordure" }, { v: "arrondi", l: "Bordure arrondie" }, { v: "etiquette", l: "Avec texte" },
];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function compose(qrBlob: Blob, frame: Frame, fg: string, bg: string, label: string, title: string) {
  const img = await createImageBitmap(qrBlob);
  const Q = img.width;
  const pad = frame === "none" ? 0 : Math.round(Q * 0.07);
  const labelH = frame === "etiquette" ? Math.round(Q * 0.2) : 0;
  const titleH = !labelH && title.trim() ? Math.round(Q * 0.15) : 0;
  const bandH = labelH || titleH;
  const W = Q + pad * 2;
  const H = Q + pad * 2 + bandH;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  const r = frame === "simple" ? 0 : Math.round(Q * 0.08);
  if (frame !== "none") {
    ctx.fillStyle = fg;
    roundRect(ctx, 0, 0, W, H, r); ctx.fill();
    const b = Math.round(Q * 0.025);
    ctx.fillStyle = bg;
    roundRect(ctx, b, b, W - 2 * b, Q + pad * 2 - 2 * b, Math.max(0, r - b)); ctx.fill();
  }
  ctx.drawImage(img, pad, pad);
  if (bandH) {
    let text: string;
    if (labelH) {
      text = label || title || "SCANNEZ-MOI";
      ctx.fillStyle = bg;
      ctx.font = `800 ${Math.round(labelH * 0.45)}px Manrope, sans-serif`;
    } else {
      text = title.trim();
      ctx.fillStyle = bg;
      ctx.fillRect(0, Q + pad * 2, W, bandH);
      ctx.fillStyle = fg;
      ctx.font = `800 ${Math.round(bandH * 0.5)}px Manrope, sans-serif`;
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, W / 2, Q + pad * 2 + bandH / 2, W - pad * 2);
  }
  return c.toDataURL("image/png");
}

function Index() {
  const [mode, setMode] = useState<"lien" | "texte">("lien");
  const [data, setData] = useState("https://");
  const [logo, setLogo] = useState<string | null>(null);
  const [fg, setFg] = useState("#1f4d3a");
  const [bg, setBg] = useState("#f7f3e8");
  const [dot, setDot] = useState<DotType>("rounded");
  const [corner, setCorner] = useState<CornerType>("extra-rounded");
  const [frame, setFrame] = useState<Frame>("arrondi");
  const [label, setLabel] = useState("SCANNEZ-MOI");
  const [title, setTitle] = useState("");
  const [png, setPng] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancel = false;
    const t = setTimeout(async () => {
      const { default: QRCodeStyling } = await import("qr-code-styling");
      const qr = new QRCodeStyling({
        width: 800, height: 800, type: "canvas", margin: 24,
        data: data.trim() || " ",
        ...(logo ? { image: logo } : {}),
        qrOptions: { errorCorrectionLevel: logo ? "H" : "Q" },
        dotsOptions: { type: dot, color: fg },
        cornersSquareOptions: { type: corner, color: fg },
        cornersDotOptions: { type: corner === "square" ? "square" : "dot", color: fg },
        backgroundOptions: { color: bg },
        imageOptions: { margin: 8, imageSize: 0.35, crossOrigin: "anonymous" },
      });
      const blob = (await qr.getRawData("png")) as Blob;
      if (!blob || cancel) return;
      const url = await compose(blob, frame, fg, bg, label, title);
      if (!cancel) setPng(url);
    }, 200);
    return () => { cancel = true; clearTimeout(t); };
  }, [data, logo, fg, bg, dot, corner, frame, label, title]);

  const onLogo = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setLogo(r.result as string);
    r.readAsDataURL(f);
  };

  const downloadPng = () => {
    const a = document.createElement("a");
    a.href = png; a.download = "qr-code.png"; a.click();
  };

  const exportPdf = async () => {
    if (!png) return;
    setBusy(true);
    const { jsPDF } = await import("jspdf");
    const img = new Image(); img.src = png; await img.decode();
    const ratio = img.height / img.width;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const cols = 4, rows = 8, m = 8;
    const cw = (210 - m * 2) / cols, ch = (297 - m * 2) / rows;
    const g = 3;
    let h = ch - g, w = h / ratio;
    if (w > cw - g) { w = cw - g; h = w * ratio; }
    doc.setDrawColor(200); doc.setLineDashPattern([1, 1], 0); doc.setLineWidth(0.1);
    for (let i = 1; i < cols; i++) doc.line(m + i * cw, m, m + i * cw, 297 - m);
    for (let j = 1; j < rows; j++) doc.line(m, m + j * ch, 210 - m, m + j * ch);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++)
        doc.addImage(png, "PNG", m + i * cw + (cw - w) / 2, m + j * ch + (ch - h) / 2, w, h, "qr", "FAST");
    doc.save("qr-codes-32.pdf");
    setBusy(false);
  };

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary"}`;

  return (
    <main className="min-h-screen px-5 py-10 md:px-10">
      <header className="mx-auto mb-10 max-w-6xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent">Atelier QR</p>
        <h1 className="mt-2 text-4xl font-extrabold md:text-6xl">Votre QR code, prêt à imprimer.</h1>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_420px]">
        <section className="space-y-8 rounded-3xl border border-border bg-card p-6 md:p-8">
          <Block n="1" title="Contenu">
            <div className="mb-3 flex gap-2">
              <button className={chip(mode === "lien")} onClick={() => { setMode("lien"); setData("https://"); }}>Lien</button>
              <button className={chip(mode === "texte")} onClick={() => { setMode("texte"); setData(""); }}>Texte</button>
            </div>
            {mode === "lien" ? (
              <input value={data} onChange={(e) => setData(e.target.value)} placeholder="https://monsite.fr"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-ring" />
            ) : (
              <textarea value={data} onChange={(e) => setData(e.target.value)} rows={4} placeholder="Votre texte…"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-ring" />
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              <button className={chip(false)} onClick={() => fileRef.current?.click()}>
                {logo ? "Changer l'image" : "Ajouter une image au centre"}
              </button>
              {logo && (
                <>
                  <img src={logo} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  <button className="text-sm text-muted-foreground underline" onClick={() => setLogo(null)}>Retirer</button>
                </>
              )}
            </div>
            <div className="mt-4">
              <label className="mb-2 block text-sm text-muted-foreground">Titre (imprimé sous le QR code)</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30}
                placeholder="Ex : Wi-Fi du café, Menu du jour…"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-ring" />
            </div>
          </Block>

          <Block n="2" title="Couleurs">
            <div className="flex flex-wrap gap-2">
              {PALETTES.map((p) => (
                <button key={p.name} onClick={() => { setFg(p.fg); setBg(p.bg); }}
                  className={`${chip(fg === p.fg && bg === p.bg)} flex items-center gap-2`}>
                  <span className="flex h-5 w-5 overflow-hidden rounded-full border border-border">
                    <span className="w-1/2" style={{ background: p.fg }} /><span className="w-1/2" style={{ background: p.bg }} />
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-6 text-sm font-semibold">
              <label className="flex items-center gap-2">Motif <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-9 w-12 cursor-pointer rounded" /></label>
              <label className="flex items-center gap-2">Fond <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 w-12 cursor-pointer rounded" /></label>
            </div>
          </Block>

          <Block n="3" title="Forme">
            <p className="mb-2 text-sm text-muted-foreground">Points</p>
            <div className="flex flex-wrap gap-2">{DOTS.map((d) => <button key={d.v} className={chip(dot === d.v)} onClick={() => setDot(d.v)}>{d.l}</button>)}</div>
            <p className="mb-2 mt-4 text-sm text-muted-foreground">Coins</p>
            <div className="flex flex-wrap gap-2">{CORNERS.map((d) => <button key={d.v} className={chip(corner === d.v)} onClick={() => setCorner(d.v)}>{d.l}</button>)}</div>
          </Block>

          <Block n="4" title="Encadrement">
            <div className="flex flex-wrap gap-2">{FRAMES.map((d) => <button key={d.v} className={chip(frame === d.v)} onClick={() => setFrame(d.v)}>{d.l}</button>)}</div>
            {frame === "etiquette" && (
              <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={24}
                className="mt-3 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-ring" />
            )}
          </Block>
        </section>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-3xl bg-primary p-8 text-primary-foreground">
            <div className="flex aspect-square items-center justify-center rounded-2xl bg-background p-6">
              {png ? <img src={png} alt="Aperçu du QR code" className="max-h-full max-w-full" /> : <span className="text-muted-foreground">…</span>}
            </div>
            <button onClick={exportPdf} disabled={busy || !png}
              className="mt-6 w-full rounded-xl bg-accent px-6 py-4 text-lg font-bold text-accent-foreground transition hover:brightness-105 disabled:opacity-60">
              {busy ? "Génération…" : "Exporter PDF · 32 exemplaires"}
            </button>
            <button onClick={downloadPng} disabled={!png}
              className="mt-3 w-full rounded-xl border border-primary-foreground/30 px-6 py-3 font-semibold hover:bg-primary-foreground/10">
              Télécharger en image
            </button>
            <p className="mt-4 text-center text-xs opacity-75">Planche A4 · 4 × 8 · traits de découpe</p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function Block({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm text-secondary-foreground">{n}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}
