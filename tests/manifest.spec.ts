import { readFileSync } from "fs";
import { join } from "path";

describe("PWA Manifest", () => {
  it("define start_url y scope apuntando a la subruta del repo", () => {
    const p = join(process.cwd(), "public", "manifest.json");
    const raw = readFileSync(p, "utf8");
    const m = JSON.parse(raw);
    const validStarts = ["/ERP_Negocios1125/", "https://janier1992.github.io/ERP_Negocios1125/"];
    expect(typeof m.start_url).toBe("string");
    expect(typeof m.scope).toBe("string");
    expect(validStarts.some((s) => String(m.start_url).startsWith(s))).toBe(true);
    expect(validStarts.some((s) => String(m.scope).startsWith(s))).toBe(true);
  });
  it("incluye id, version_name y version_code", () => {
    const p = join(process.cwd(), "public", "manifest.json");
    const raw = readFileSync(p, "utf8");
    const m = JSON.parse(raw);
    expect(m.id).toBe("/ERP_Negocios1125/");
    expect(m.version_name).toMatch(/^\d+\.\d+\.\d+$/);
    expect(typeof m.version_code).toBe("number");
    expect(m.version_code).toBeGreaterThan(0);
  });
});