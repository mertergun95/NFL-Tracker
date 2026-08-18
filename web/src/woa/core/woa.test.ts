import { describe, expect, it } from "vitest";
import { GAME_STEPS, PLAYER_STEPS, TOOLS, toolsInBlueprint } from "./blueprint";
import {
  addPlayer, coverage, createSession, gateOpen, makePlayer, missingGateSteps,
  patchStep, stepStatus,
} from "./session";
import { buildMarkdown } from "./report";
import type { WoaSession } from "./types";

const base = (): WoaSession => createSession({
  season: 2026, week: 7, gameId: "2026_07_LA_SF",
  away: "LA", home: "SF", dataSeason: 2025,
});

const stepDef = (id: string) =>
  [...GAME_STEPS, ...PLAYER_STEPS].find((s) => s.id === id)!;

describe("blueprint", () => {
  it("her kaynağı katalogda tanımlı bir araca bağlar", () => {
    for (const tool of toolsInBlueprint()) expect(TOOLS[tool]).toBeDefined();
  });

  it("kilit adımlar maçın iki ucunu da kapsar", () => {
    const required = GAME_STEPS.filter((s) => s.required).map((s) => s.id);
    expect(required).toEqual(["M1", "M2", "M4", "M8"]);
  });
});

describe("adım durumu", () => {
  it("yalnız kutu işaretlemek adımı doldurmuş saymaz", () => {
    const state = { checks: { "pff.greenline": true } };
    expect(stepStatus(state, stepDef("M1"))).toBe("empty");
  });

  it("tek takıma yazılan not adımı doldurur", () => {
    expect(stepStatus({ away: "yağmur bekleniyor" }, stepDef("M1"))).toBe("filled");
  });

  it("yapısal alan da adımı doldurur", () => {
    expect(stepStatus({ values: { spread: "-3" } }, stepDef("M1"))).toBe("filled");
  });

  it("atlanan adım dolu sayılmaz", () => {
    expect(stepStatus({ skipped: true, note: "x" }, stepDef("M8"))).toBe("skipped");
  });
});

describe("oyuncu kilidi", () => {
  it("kilit adımlar bitmeden kapalıdır", () => {
    let s = base();
    expect(gateOpen(s)).toBe(false);
    s = patchStep(s, { kind: "game" }, "M1", { away: "a" });
    s = patchStep(s, { kind: "game" }, "M2", { home: "b" });
    expect(gateOpen(s)).toBe(false);
    expect(missingGateSteps(s).map((d) => d.id)).toEqual(["M4", "M8"]);
  });

  it("dördü de dolunca açılır", () => {
    let s = base();
    for (const id of ["M1", "M2", "M4"]) s = patchStep(s, { kind: "game" }, id, { away: "x" });
    s = patchStep(s, { kind: "game" }, "M8", { note: "ev sahibi önde kapatır" });
    expect(gateOpen(s)).toBe(true);
  });

  it("atlanan kilit adım kilidi açmaz", () => {
    let s = base();
    for (const id of ["M1", "M2", "M4"]) s = patchStep(s, { kind: "game" }, id, { away: "x" });
    s = patchStep(s, { kind: "game" }, "M8", { skipped: true });
    expect(gateOpen(s)).toBe(false);
  });
});

describe("kapsama", () => {
  it("işaretlenmemiş araçlar kullanılmayan sayılır", () => {
    const s = base();
    const pff = coverage(s).find((c) => c.provider === "pff")!;
    expect(pff.used).toHaveLength(0);
    expect(pff.unused.length).toBeGreaterThan(0);
  });

  it("işaretlenen araç sağlayıcısının kullanılanlarına geçer", () => {
    const s = patchStep(base(), { kind: "game" }, "M1",
                        { checks: { "pff.greenline": true } });
    const pff = coverage(s).find((c) => c.provider === "pff")!;
    expect(pff.used).toContain("Greenline");
    expect(pff.unused).not.toContain("Greenline");
  });

  it("oyuncunun pozisyonunda görünmeyen araç sayılmaz", () => {
    let s = base();
    const qb = makePlayer({ playerId: "1", name: "QB", position: "QB", team: "LA" });
    s = addPlayer(s, qb);
    // RB Elusiveness bir QB kartında hiç gösterilmez; eski bir işaret kalmışsa
    // kapsamayı şişirmemeli.
    s = patchStep(s, { kind: "player", playerId: qb.id }, "P2",
                  { checks: { "hashtag.rbElusiveness": true } });
    const hashtag = coverage(s).find((c) => c.provider === "hashtag")!;
    expect(hashtag.used).not.toContain("RB Elusiveness");
  });
});

describe("rapor", () => {
  it("kapsanmayan adımları ve kapsamayı yazar", () => {
    let s = base();
    s = patchStep(s, { kind: "game" }, "M1",
                  { away: "rüzgar 18mph", values: { spread: "-3", total: "44" },
                    checks: { "pff.greenline": true } });
    s = patchStep(s, { kind: "game" }, "M3", { skipped: true });
    const md = buildMarkdown(s);
    expect(md).toContain("rüzgar 18mph");
    expect(md).toContain("-3 / 44");
    expect(md).toContain("Greenline");
    expect(md).toMatch(/M3/);
  });

  it("oyuncu kartlarını raporlar", () => {
    let s = base();
    const p = makePlayer({ playerId: "1", name: "Puka Nacua", position: "WR", team: "LA" });
    s = addPlayer(s, p);
    s = patchStep(s, { kind: "player", playerId: p.id }, "P1", { note: "hedef payı %28" });
    const md = buildMarkdown(s);
    expect(md).toContain("Puka Nacua");
    expect(md).toContain("hedef payı %28");
  });

  it("aynı oyuncu iki kez eklenmez", () => {
    let s = base();
    const p = makePlayer({ playerId: "1", name: "A", position: "WR", team: "LA" });
    s = addPlayer(s, p);
    s = addPlayer(s, makePlayer({ playerId: "1", name: "A", position: "WR", team: "LA" }));
    expect(s.players).toHaveLength(1);
  });
});
