import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { bootstrapEncryptedDatabase } from "./encrypted-db";
import {
  compileFilterSpecToExpenseQuery,
  parseNlqToFilterSpec,
  queryExpensesByFilterSpec,
  type FilterSpec
} from "./nlq";
import { runMigrations } from "./migrations";
import { BudgetCrudRepository } from "./repositories";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-nlq-"));
  tempRoots.push(dir);
  return dir;
}

describe("deterministic nlq parser", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses phrase fixtures into deterministic FilterSpec output", () => {
    const referenceDate = new Date("2026-03-15T00:00:00.000Z");

    const parsedA = parseNlqToFilterSpec(
      "scenario:baseline expenses this month over $100 tag:it",
      { referenceDate }
    );
    expect(parsedA.filterSpec).toEqual({
      scenarioId: "baseline",
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
      amountMinMinor: 10000,
      tagNames: ["it"]
    });

    const parsedB = parseNlqToFilterSpec(
      "expenses between 2026-01-01 and 2026-02-28 under $250.50 tag:finance"
    );
    expect(parsedB.filterSpec).toEqual({
      dateFrom: "2026-01-01",
      dateTo: "2026-02-28",
      amountMaxMinor: 25050,
      tagNames: ["finance"]
    });
  });

  it("rejects unknown fields and SQL-like tokens in compiler input", () => {
    expect(() =>
      compileFilterSpecToExpenseQuery({ scenarioId: "baseline", unknownField: "x" } as unknown as FilterSpec)
    ).toThrow(/Unknown filter field/);

    expect(() =>
      compileFilterSpecToExpenseQuery({ scenarioId: "baseline; DROP TABLE expense_line" })
    ).toThrow(/Unsafe token/);

    expect(() =>
      compileFilterSpecToExpenseQuery({ tagNames: ["finance--prod"] })
    ).toThrow(/Unsafe token/);
  });

  it("produces explanation preview consistent with executed query filters", () => {
    const dataDir = createTempDir();
    const boot = bootstrapEncryptedDatabase(dataDir);
    try {
      runMigrations(boot.db);
      const repo = new BudgetCrudRepository(boot.db);
      const vendorId = repo.createVendor({ name: "Vendor" });
      const serviceId = repo.createService({ vendorId, name: "Service", status: "active" });
      const expenseId = repo.createExpenseLineWithOptionalRecurrence({
        scenarioId: "baseline",
        serviceId,
        name: "Platform subscription",
        expenseType: "one_time",
        status: "planned",
        amountMinor: 12000,
        currency: "USD",
        startDate: "2026-02-10"
      });
      repo.createExpenseLineWithOptionalRecurrence({
        scenarioId: "baseline",
        serviceId,
        name: "Small tool",
        expenseType: "one_time",
        status: "planned",
        amountMinor: 3000,
        currency: "USD",
        startDate: "2026-02-11"
      });

      const dimensionId = repo.createDimension({
        name: "Owner",
        mode: "single_select",
        required: false
      });
      const itTagId = repo.createTag({ dimensionId, name: "it" });
      repo.assignTagToEntity({
        entityType: "expense_line",
        entityId: expenseId,
        dimensionId,
        tagId: itTagId
      });

      const parsed = parseNlqToFilterSpec(
        "scenario:baseline expenses over $50 between 2026-01-01 and 2026-12-31 tag:it"
      );
      const queried = queryExpensesByFilterSpec(boot.db, parsed.filterSpec);

      expect(queried.rows).toHaveLength(1);
      expect(queried.rows[0].id).toBe(expenseId);
      expect(queried.compiled.explanation).toContain("scenario = baseline");
      expect(queried.compiled.explanation).toContain("amount >= 5000");
      expect(queried.compiled.explanation).toContain("tag = it");
    } finally {
      boot.db.close();
    }
  });
});
