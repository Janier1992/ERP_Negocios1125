import config from "../vite.config";

describe("Routing config", () => {
  it("usa BASE desde entorno para producción/subruta", () => {
    const result = (config as any)({ mode: "production" });
    // Cuando no hay VITE_BASE, base debe ser "/" por defecto
    expect(result.base).toBe("/");
    // Simulamos entorno con subruta
    process.env.VITE_BASE = "/ERP_Negocios1125/";
    const result2 = (config as any)({ mode: "production" });
    expect(result2.base).toBe("/ERP_Negocios1125/");
    delete process.env.VITE_BASE;
  });
});