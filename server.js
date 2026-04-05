/**
 * TharinAi — PPTX Microservice
 * Receives slide JSON from CF Worker → builds real .pptx → returns base64
 *
 * Deploy free on Railway:
 *   1. Push this folder to a GitHub repo
 *   2. Railway → New Project → Deploy from GitHub
 *   3. Set env var: SECRET_KEY=any_random_string
 *   4. Copy your Railway URL → set PPTX_SERVICE_URL in CF Worker secrets
 */

const express  = require('express');
const PptxGen  = require('pptxgenjs');
const app      = express();

app.use(express.json({ limit: '2mb' }));

const SECRET = process.env.SECRET_KEY || 'tharinai-pptx-secret';
const PORT   = process.env.PORT || 3000;

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'TharinAi PPTX Service running' }));

// ── Generate PPTX ─────────────────────────────────────────────────────────────
// POST /generate
// Body: { secret, deck: { title, theme, slides: [{ title, bullets, note }] } }
// Returns: { base64, filename }
app.post('/generate', async (req, res) => {
  try {
    // Auth check
    if (req.body.secret !== SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deck   = req.body.deck;
    const slides = deck?.slides;

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({ error: 'No slides provided' });
    }

    // ── Build PPTX (same style as TharinAi HTML app) ─────────────────────────
    const pres   = new PptxGen();
    const accent = (deck.theme || '#1a56db').replace('#', '');

    pres.layout = 'LAYOUT_WIDE';
    pres.title  = deck.title || 'Presentation';

    slides.forEach((s, si) => {
      const slide = pres.addSlide();

      // White background
      slide.background = { color: 'FFFFFF' };

      // Top accent bar
      slide.addShape(pres.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.18,
        fill: { color: accent }
      });

      // Slide number
      slide.addText(`${si + 1}/${slides.length}`, {
        x: 8.8, y: 0, w: 0.7, h: 0.18,
        fontSize: 7, color: 'FFFFFF',
        align: 'center', valign: 'middle', bold: true
      });

      // Slide title
      slide.addText(s.title || `Slide ${si + 1}`, {
        x: 0.4, y: 0.28, w: 9.2, h: 0.7,
        fontSize: si === 0 ? 30 : 22,
        bold: true, color: accent, fontFace: 'Calibri'
      });

      // Divider line
      slide.addShape(pres.ShapeType.line, {
        x: 0.4, y: 1.05, w: 9.2, h: 0,
        line: { color: accent + '44', width: 0.5 }
      });

      // Bullets
      const bullets = (s.bullets || []).slice(0, 6);
      bullets.forEach((b, bi) => {
        slide.addText('▸  ' + b, {
          x: 0.5, y: 1.2 + bi * 0.5, w: 9.0, h: 0.46,
          fontSize: 14, color: '363636', fontFace: 'Calibri'
        });
      });

      // Speaker notes
      if (s.note) slide.addNotes(s.note);
    });

    // ── Export as base64 ──────────────────────────────────────────────────────
    const base64   = await pres.write({ outputType: 'base64' });
    const filename = (deck.title || 'presentation')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 60) || 'presentation';

    return res.json({ base64, filename: filename + '.pptx' });

  } catch (err) {
    console.error('[PPTX Error]', err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🎞️  TharinAi PPTX Service running on port ${PORT}`);
});
