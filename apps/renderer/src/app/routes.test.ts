import { describe, expect, it } from "vitest";

import { APP_ROUTES, NAV_ROUTES, resolveRouteLabel } from "./routes";

describe("route configuration", () => {
  it("contains every planned top-level route", () => {
    const paths = APP_ROUTES.map((route) => route.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/expenses",
        "/services",
        "/contracts",
        "/vendors",
        "/tags",
        "/scenarios",
        "/alerts",
        "/import",
        "/reports",
        "/nlq",
        "/settings",
        "/developer"
      ])
    );
  });

  it("keeps developer route out of primary navigation", () => {
    expect(NAV_ROUTES.some((route) => route.path === "/developer")).toBe(false);
  });

  it("resolves a page label from route path", () => {
    expect(resolveRouteLabel("/alerts")).toBe("Alerts");
    expect(resolveRouteLabel("/reports/variance")).toBe("Reports");
  });
});
