import { redirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { UserError, unwrap, unwrapAction, withActionResult } from "./action-result";

describe("withActionResult", () => {
  it("renvoie la donnée en cas de succès", async () => {
    const action = withActionResult(async (a: number, b: number) => a + b);
    expect(await action(1, 2)).toEqual({ ok: true, data: 3 });
  });

  it("transmet le message d'une UserError", async () => {
    const action = withActionResult(async () => {
      throw new UserError("Stock insuffisant pour Savon.");
    });
    expect(await action()).toEqual({ ok: false, error: "Stock insuffisant pour Savon." });
  });

  it("masque les erreurs techniques derrière un message générique", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const action = withActionResult(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:5432");
    });
    const result = await action();
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).not.toContain("ECONNREFUSED");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("traduit les codes Prisma courants", async () => {
    const action = withActionResult(async () => {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    });
    expect(await action()).toEqual({ ok: false, error: "Cette valeur existe déjà (doublon)." });
  });

  it("laisse passer les redirect() de Next", async () => {
    const action = withActionResult(async () => {
      redirect("/admin/login");
    });
    await expect(action()).rejects.toThrow("NEXT_REDIRECT");
  });
});

describe("unwrap / unwrapAction", () => {
  it("renvoie la donnée ou relève une Error au bon message", async () => {
    expect(unwrap({ ok: true, data: 5 })).toBe(5);
    expect(() => unwrap({ ok: false, error: "Oups" })).toThrow("Oups");

    const failing = unwrapAction(async () => ({ ok: false as const, error: "Refusé" }));
    await expect(failing()).rejects.toThrow("Refusé");
  });
});
