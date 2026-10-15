import type { jsPDF } from "jspdf";
import type { CheckDetails } from "@shared/checkwriter";

type PathOperation = { op: "m" | "l" | "c" | "h"; c: number[] };
type MicrFont = Record<string, PathOperation[]>;
type MicrRun = { value: string; x: number };

const PITCH = 9; // One eighth inch, independent of the source font's advance width.
const BASELINE = 250.5; // 3/16 inch above the first check's bottom edge at 264pt.
const FONT_SCALE = 12 / 1000; // Original Type 1 FontMatrix at 12pt.
const FONT_URL = "/fonts/gnumicr/GnuMICR.raw";
const glyphNames = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "A", "C"];
const operatorArguments: Record<string, number | undefined> = { hsbw: 2, hstem: 2, vstem: 2, rmoveto: 2, hmoveto: 1, vmoveto: 1, rlineto: 2, hlineto: 1, vlineto: 1, rrcurveto: 6, hvcurveto: 4, vhcurveto: 4, closepath: 0, endchar: 0 };
let fontPromise: Promise<MicrFont> | undefined;

// Read only outline operators, never execute the PostScript resource. The GPL
// font stays in public/fonts alongside its original source, notice and license;
// neither its glyph data nor a converted font is compiled into this app bundle.
function parseFont(source: string): MicrFont {
  if (!/\/FontName\s+\/GnuMICR\s+def/.test(source) || !/\/FontMatrix\s*\[\s*0\.0010*\s+0\s+0\s+0\.0010*\s+0\s+0\s*\]/.test(source)) {
    throw new Error("The MICR font resource is invalid. Reload the page before printing.");
  }
  const font: MicrFont = {};
  for (let index = 0; index < glyphNames.length; index++) {
    const name = glyphNames[index];
    const body = source.match(new RegExp(`/${name}\\s*\\{([\\s\\S]*?)\\}\\s*ND`))?.[1];
    if (!body) throw new Error("The MICR font resource is incomplete. Reload the page before printing.");
    const operations: PathOperation[] = [];
    const numbers: number[] = [];
    let x = 0, y = 0;
    const move = (dx: number, dy: number, op: "m" | "l") => {
      x += dx; y += dy; operations.push({ op, c: [x, y] });
    };
    const curve = (dx1: number, dy1: number, dx2: number, dy2: number, dx3: number, dy3: number) => {
      const c = [x + dx1, y + dy1, x + dx1 + dx2, y + dy1 + dy2, x + dx1 + dx2 + dx3, y + dy1 + dy2 + dy3];
      x = c[4]; y = c[5]; operations.push({ op: "c", c });
    };
    for (const token of body.replace(/%[^\r\n]*/g, "").trim().split(/\s+/)) {
      if (/^-?\d+(?:\.\d+)?$/.test(token)) { numbers.push(Number(token)); continue; }
      const count = operatorArguments[token];
      if (count === undefined || numbers.length !== count) throw new Error("The MICR font outlines could not be read. Reload the page before printing.");
      const n = numbers.splice(0);
      switch (token) {
        case "hsbw": x = n[0]; y = 0; break;
        case "hstem": case "vstem": break; // Hinting is not needed for vector PDF paths.
        case "rmoveto": move(n[0], n[1], "m"); break;
        case "hmoveto": move(n[0], 0, "m"); break;
        case "vmoveto": move(0, n[0], "m"); break;
        case "rlineto": move(n[0], n[1], "l"); break;
        case "hlineto": move(n[0], 0, "l"); break;
        case "vlineto": move(0, n[0], "l"); break;
        case "rrcurveto": curve(n[0], n[1], n[2], n[3], n[4], n[5]); break;
        case "hvcurveto": curve(n[0], 0, n[1], n[2], 0, n[3]); break;
        case "vhcurveto": curve(0, n[0], n[1], n[2], n[3], 0); break;
        case "closepath": operations.push({ op: "h", c: [] }); break;
        case "endchar": break;
      }
    }
    if (numbers.length || !operations.length) throw new Error("The MICR font outlines are incomplete. Reload the page before printing.");
    font[index < 10 ? String(index) : name] = operations;
  }
  return font;
}

async function loadFont(): Promise<MicrFont> {
  if (!fontPromise) {
    fontPromise = (async () => {
      const response = await fetch(FONT_URL);
      if (!response.ok) throw new Error("Font download failed");
      return parseFont(await response.text());
    })().catch(() => {
      // A failed load must be retryable without issuing a replacement check.
      fontPromise = undefined;
      throw new Error("Unable to load the MICR print font. Reload the page and try printing again.");
    });
  }
  return fontPromise;
}

export async function prepareCheckMicr(check: CheckDetails, fontSource?: string): Promise<(doc: jsPDF) => void> {
  // Old snapshots have no banking fields. Preserve their preprinted-stock reprint.
  if (check.routingNumber === undefined && check.accountNumber === undefined) return () => {};
  if (!/^\d{9}$/.test(check.routingNumber || "") || !/^\d{5,17}$/.test(check.accountNumber || "")) {
    throw new Error("Set the full account number and nine-digit routing number in Bank Accounts before printing.");
  }
  const runs: MicrRun[] = [
    { value: `A${check.routingNumber}A`, x: 202.5 }, // Transit positions 43 through 33.
    { value: `${check.accountNumber}C`, x: 310.5 }, // On-us field, positions 31 through 14.
  ];
  if (/^\d{1,9}$/.test(check.number)) {
    const auxiliary = `C${check.number}C`;
    runs.unshift({ value: auxiliary, x: 193.5 - auxiliary.length * PITCH });
  }
  const font = fontSource === undefined ? await loadFont() : parseFont(fontSource);
  return doc => {
    doc.saveGraphicsState();
    doc.setFillColor(0, 0, 0);
    for (const run of runs) {
      for (let index = 0; index < run.value.length; index++) {
        const character = run.value[index];
        const origin = run.x + index * PITCH;
        doc.path(font[character].map(({ op, c }) => ({ op, c: c.map((value, i) => i % 2 === 0 ? origin + value * FONT_SCALE : BASELINE - value * FONT_SCALE) })));
        doc.fill();
      }
    }
    doc.restoreGraphicsState();
  };
}
