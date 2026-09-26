import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { Colors, Tints, Brand } from '../constants/Theme.ts';
import {
  DEFAULT_THEME_PREFERENCE,
  THEME_OPTIONS,
  parseThemePreference,
} from '../utils/themePreference.ts';

// ─── Colour maths (WCAG 2.x) ──────────────────────────────────────────────

function parseColor(c) {
  const rgba = c.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const [r, g, b, a = 1] = rgba[1].split(',').map(Number);
    return [r, g, b, a];
  }
  const h = c.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1);
}

/** Flattens a possibly translucent colour over an opaque one. */
function over(fg, bg) {
  const [r, g, b, a] = parseColor(fg);
  const [R, G, B] = parseColor(bg);
  return [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
}

function luminance([r, g, b]) {
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const rgb = (c) => parseColor(c);

function hslSaturation([r, g, b]) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  if (max === min) return 0;
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

const AA = 4.5;

export function runThemeTests(describe, test) {
  describe('Theme Suite 1: Light is the default, the choice is kept', () => {
    test('TH1.1 A fresh install, or anything unreadable, gets light', () => {
      assert.strictEqual(DEFAULT_THEME_PREFERENCE, 'light');
      for (const raw of [null, undefined, '', 'Dark', 'auto', '{"x":1}', 42]) {
        assert.strictEqual(parseThemePreference(raw), 'light', `stored ${JSON.stringify(raw)}`);
      }
    });

    test('TH1.2 Each choice the settings row offers round-trips', () => {
      assert.deepStrictEqual(THEME_OPTIONS.map((o) => o.value), ['light', 'dark', 'system']);
      for (const { value } of THEME_OPTIONS) assert.strictEqual(parseThemePreference(value), value);
    });

    test('TH1.3 app.json keeps userInterfaceStyle "automatic"', () => {
      // The dev client pins React Native's Appearance to this value when it
      // loads a bundle, so "light" here makes the in-app Dark and Auto choices
      // silently do nothing in development. Light-by-default comes from
      // ThemeService, not from the native config.
      const appJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'app.json'), 'utf8'));
      assert.strictEqual(appJson.expo.userInterfaceStyle, 'automatic');
    });
  });

  describe('Theme Suite 2: Dark palette', () => {
    const d = Colors.dark;

    test('TH2.1 Every text tier clears AA on every dark surface', () => {
      for (const text of ['text', 'textSecondary', 'textTertiary']) {
        for (const surface of ['background', 'surface', 'surfaceSecondary']) {
          const ratio = contrast(rgb(d[text]), rgb(d[surface]));
          assert.ok(ratio >= AA, `${text} on ${surface}: ${ratio.toFixed(2)}:1`);
        }
      }
      const tab = contrast(rgb(d.tabInactive), rgb(d.tabBg));
      assert.ok(tab >= AA, `tabInactive on tabBg: ${tab.toFixed(2)}:1`);
    });

    test('TH2.2 The base is neutral graphite, not indigo-navy', () => {
      // The old base (#12132b) had a 25-point violet cast that muddied every
      // wash laid over it and clashed with the azure band.
      for (const token of ['background', 'surface', 'surfaceSecondary', 'card', 'tabBg']) {
        const [r, g, b] = rgb(d[token]);
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        assert.ok(spread <= 20, `${token} ${d[token]} has a ${spread}-point colour cast`);
      }
    });

    test('TH2.3 Surfaces get lighter as they rise', () => {
      const L = (t) => luminance(rgb(d[t]));
      assert.ok(L('background') < L('surface'), 'surface must sit above the page');
      assert.ok(L('surface') < L('surfaceSecondary'), 'surfaceSecondary must sit above surface');
      assert.ok(L('lip') < L('background'), 'the lip reads as the edge under a card');
    });

    test('TH2.4 Domain washes stay faint and their ink stays legible', () => {
      const tints = { ...Tints.dark, brand: { fill: Brand.dark.wash, line: Brand.dark.washLine, ink: Brand.dark.ink } };
      for (const [name, t] of Object.entries(tints)) {
        const [, , , fillA] = parseColor(t.fill);
        const [, , , lineA] = parseColor(t.line);
        assert.ok(fillA <= 0.12, `${name} fill alpha ${fillA}`);
        assert.ok(lineA <= 0.2, `${name} outline alpha ${lineA}`);
        for (const base of ['background', 'surface']) {
          const ratio = contrast(rgb(t.ink), over(t.fill, d[base]));
          assert.ok(ratio >= AA, `${name} ink on its wash over ${base}: ${ratio.toFixed(2)}:1`);
        }
      }
    });

    test('TH2.5 The brand band stays vivid and its type legible', () => {
      const band = rgb(Brand.dark.heroFrom);
      assert.ok(hslSaturation(band) >= 0.6, `heroFrom ${Brand.dark.heroFrom} is greyed out`);
      assert.ok(contrast(rgb(Brand.dark.onHero), band) >= AA);
      const muted = contrast(over(Brand.dark.onHeroMuted, Brand.dark.heroFrom), band);
      assert.ok(muted >= AA, `onHeroMuted on heroFrom: ${muted.toFixed(2)}:1`);
    });

    test('TH2.6 No screen still hardcodes the old indigo-navy dark palette', () => {
      const old = ['#12132b', '#1b1d3a', '#262a4d', '#32365c', '#171936', '#0d0e21', '#3d4468', '#464d75', '#2d2f54', '#1a1f3d', '#0c0b2b', '#12103d'];
      const offenders = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
            const src = fs.readFileSync(p, 'utf8').toLowerCase();
            for (const hex of old) if (src.includes(hex)) offenders.push(`${path.relative(process.cwd(), p)} ${hex}`);
          }
        }
      };
      // constants/Theme.ts is held by the token tests above; its comments name the old values.
      for (const dir of ['app', 'components']) walk(path.resolve(process.cwd(), dir));
      assert.deepStrictEqual(offenders, []);
    });
  });
}
