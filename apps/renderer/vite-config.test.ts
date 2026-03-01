import { describe, expect, it } from "vitest";

import config from "./vite.config";

describe("vite config", () => {
  it("uses relative asset base for file:// packaged renderer", () => {
    expect(config.base).toBe("./");
  });

  it("defines renderer build chunking and warning handling", () => {
    expect(config.build?.chunkSizeWarningLimit).toBe(1200);
    expect(config.build?.rollupOptions?.output).toBeDefined();
    expect(config.build?.rollupOptions?.onwarn).toBeTypeOf("function");
  });
});
