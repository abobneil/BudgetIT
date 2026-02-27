import crypto from "node:crypto";

import type Database from "better-sqlite3-multiple-ciphers";
import { z } from "zod";

const vendorInputSchema = z.object({
  name: z.string().min(1),
  website: z.string().optional(),
  notes: z.string().optional()
});

const serviceInputSchema = z.object({
  vendorId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["active", "trial", "deprecated", "retiring", "retired"]),
  ownerTeam: z.string().optional()
});

const contractInputSchema = z.object({
  serviceId: z.string().min(1),
  contractNumber: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  renewalType: z.enum(["auto", "manual", "none"]).optional(),
  renewalDate: z.string().optional(),
  noticePeriodDays: z.number().int().nonnegative().optional()
});

const expenseLineInputSchema = z.object({
  scenarioId: z.string().min(1),
  serviceId: z.string().min(1),
  contractId: z.string().nullable().optional(),
  name: z.string().min(1),
  expenseType: z.enum(["recurring", "one_time"]),
  status: z.enum(["planned", "approved", "committed", "actual", "cancelled"]),
  amountMinor: z.number().int().nonnegative(),
  currency: z.literal("USD"),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional()
});

const recurrenceRuleInputSchema = z.object({
  expenseLineId: z.string().min(1),
  frequency: z.enum(["monthly", "quarterly", "yearly"]),
  interval: z.number().int().positive(),
  dayOfMonth: z.number().int().min(1).max(31),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  anchorDate: z.string().optional()
});

const dimensionInputSchema = z.object({
  name: z.string().min(1),
  mode: z.enum(["single_select", "multi_select"]),
  required: z.boolean()
});

const tagInputSchema = z.object({
  dimensionId: z.string().min(1),
  name: z.string().min(1),
  parentTagId: z.string().nullable().optional()
});

const tagAssignmentInputSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  dimensionId: z.string().min(1),
  tagId: z.string().min(1)
});

function nowIso(): string {
  return new Date().toISOString();
}

export function toUsdMinorUnits(value: number | string): number {
  const text =
    typeof value === "number" ? value.toFixed(2) : value.trim().replace(/^\$/, "");

  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(`Invalid USD amount: ${value}`);
  }

  const [whole, fractional = ""] = text.split(".");
  const cents = `${fractional}00`.slice(0, 2);
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(cents, 10);
}

export class BudgetCrudRepository {
  constructor(private readonly db: Database.Database) {}

  private touchForecastStale(): void {
    this.db
      .prepare(
        `
          UPDATE meta
          SET forecast_stale = 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `
      )
      .run();
  }

  createVendor(input: z.infer<typeof vendorInputSchema>): string {
    const parsed = vendorInputSchema.parse(input);
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO vendor (id, name, website, notes, created_at, updated_at, deleted_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        `
      )
      .run(id, parsed.name, parsed.website ?? null, parsed.notes ?? null);
    return id;
  }

  updateVendor(id: string, input: z.infer<typeof vendorInputSchema>): void {
    const parsed = vendorInputSchema.parse(input);
    this.db
      .prepare(
        `
          UPDATE vendor
          SET name = ?, website = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL
        `
      )
      .run(parsed.name, parsed.website ?? null, parsed.notes ?? null, id);
  }

  deleteVendor(id: string): void {
    this.db
      .prepare("UPDATE vendor SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);
  }

  createService(input: z.infer<typeof serviceInputSchema>): string {
    const parsed = serviceInputSchema.parse(input);
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO service (id, vendor_id, name, status, owner_team, created_at, updated_at, deleted_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        `
      )
      .run(id, parsed.vendorId, parsed.name, parsed.status, parsed.ownerTeam ?? null);
    return id;
  }

  updateService(id: string, input: z.infer<typeof serviceInputSchema>): void {
    const parsed = serviceInputSchema.parse(input);
    this.db
      .prepare(
        `
          UPDATE service
          SET vendor_id = ?, name = ?, status = ?, owner_team = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL
        `
      )
      .run(parsed.vendorId, parsed.name, parsed.status, parsed.ownerTeam ?? null, id);
  }

  deleteService(id: string): void {
    this.db
      .prepare("UPDATE service SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);
  }

  createContract(input: z.infer<typeof contractInputSchema>): string {
    const parsed = contractInputSchema.parse(input);
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO contract (
            id,
            service_id,
            contract_number,
            start_date,
            end_date,
            renewal_type,
            renewal_date,
            notice_period_days,
            created_at,
            updated_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        `
      )
      .run(
        id,
        parsed.serviceId,
        parsed.contractNumber ?? null,
        parsed.startDate ?? null,
        parsed.endDate ?? null,
        parsed.renewalType ?? null,
        parsed.renewalDate ?? null,
        parsed.noticePeriodDays ?? null
      );
    return id;
  }

  updateContract(id: string, input: z.infer<typeof contractInputSchema>): void {
    const parsed = contractInputSchema.parse(input);
    this.db
      .prepare(
        `
          UPDATE contract
          SET service_id = ?,
              contract_number = ?,
              start_date = ?,
              end_date = ?,
              renewal_type = ?,
              renewal_date = ?,
              notice_period_days = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL
        `
      )
      .run(
        parsed.serviceId,
        parsed.contractNumber ?? null,
        parsed.startDate ?? null,
        parsed.endDate ?? null,
        parsed.renewalType ?? null,
        parsed.renewalDate ?? null,
        parsed.noticePeriodDays ?? null,
        id
      );
  }

  deleteContract(id: string): void {
    this.db
      .prepare("UPDATE contract SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);
  }

  createExpenseLineWithOptionalRecurrence(
    expenseInput: z.infer<typeof expenseLineInputSchema>,
    recurrenceInput?: z.infer<typeof recurrenceRuleInputSchema>
  ): string {
    const parsedExpense = expenseLineInputSchema.parse(expenseInput);
    if (parsedExpense.expenseType === "recurring" && !recurrenceInput) {
      throw new Error("Recurring expenses require a recurrence rule.");
    }

    const id = crypto.randomUUID();
    const now = nowIso();

    const write = this.db.transaction(() => {
      this.db
        .prepare(
          `
            INSERT INTO expense_line (
              id,
              scenario_id,
              service_id,
              contract_id,
              name,
              expense_type,
              status,
              amount_minor,
              currency,
              start_date,
              end_date,
              created_at,
              updated_at,
              deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
          `
        )
        .run(
          id,
          parsedExpense.scenarioId,
          parsedExpense.serviceId,
          parsedExpense.contractId ?? null,
          parsedExpense.name,
          parsedExpense.expenseType,
          parsedExpense.status,
          parsedExpense.amountMinor,
          parsedExpense.currency,
          parsedExpense.startDate ?? null,
          parsedExpense.endDate ?? null,
          now,
          now
        );

      if (recurrenceInput) {
        const parsedRecurrence = recurrenceRuleInputSchema.parse({
          ...recurrenceInput,
          expenseLineId: id
        });
        this.createRecurrenceRule(parsedRecurrence);
      }
      this.touchForecastStale();
    });

    write();
    return id;
  }

  updateExpenseLine(id: string, input: z.infer<typeof expenseLineInputSchema>): void {
    const parsed = expenseLineInputSchema.parse(input);
    this.db
      .prepare(
        `
          UPDATE expense_line
          SET scenario_id = ?,
              service_id = ?,
              contract_id = ?,
              name = ?,
              expense_type = ?,
              status = ?,
              amount_minor = ?,
              currency = ?,
              start_date = ?,
              end_date = ?,
              updated_at = ?
          WHERE id = ? AND deleted_at IS NULL
        `
      )
      .run(
        parsed.scenarioId,
        parsed.serviceId,
        parsed.contractId ?? null,
        parsed.name,
        parsed.expenseType,
        parsed.status,
        parsed.amountMinor,
        parsed.currency,
        parsed.startDate ?? null,
        parsed.endDate ?? null,
        nowIso(),
        id
      );
    this.touchForecastStale();
  }

  deleteExpenseLine(id: string): void {
    this.db
      .prepare("UPDATE expense_line SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);
    this.touchForecastStale();
  }

  createRecurrenceRule(input: z.infer<typeof recurrenceRuleInputSchema>): string {
    const parsed = recurrenceRuleInputSchema.parse(input);
    if (parsed.frequency === "yearly" && typeof parsed.monthOfYear !== "number") {
      throw new Error("Yearly recurrence requires monthOfYear.");
    }

    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO recurrence_rule (
            id,
            expense_line_id,
            frequency,
            interval,
            day_of_month,
            month_of_year,
            anchor_date,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
      )
      .run(
        id,
        parsed.expenseLineId,
        parsed.frequency,
        parsed.interval,
        parsed.dayOfMonth,
        parsed.monthOfYear ?? null,
        parsed.anchorDate ?? null
      );
    this.touchForecastStale();
    return id;
  }

  updateRecurrenceRule(id: string, input: z.infer<typeof recurrenceRuleInputSchema>): void {
    const parsed = recurrenceRuleInputSchema.parse(input);
    if (parsed.frequency === "yearly" && typeof parsed.monthOfYear !== "number") {
      throw new Error("Yearly recurrence requires monthOfYear.");
    }

    this.db
      .prepare(
        `
          UPDATE recurrence_rule
          SET expense_line_id = ?,
              frequency = ?,
              interval = ?,
              day_of_month = ?,
              month_of_year = ?,
              anchor_date = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      )
      .run(
        parsed.expenseLineId,
        parsed.frequency,
        parsed.interval,
        parsed.dayOfMonth,
        parsed.monthOfYear ?? null,
        parsed.anchorDate ?? null,
        id
      );
    this.touchForecastStale();
  }

  deleteRecurrenceRule(id: string): void {
    this.db.prepare("DELETE FROM recurrence_rule WHERE id = ?").run(id);
    this.touchForecastStale();
  }

  createDimension(input: z.infer<typeof dimensionInputSchema>): string {
    const parsed = dimensionInputSchema.parse(input);
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO dimension (id, name, mode, required, created_at, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
      )
      .run(id, parsed.name, parsed.mode, parsed.required ? 1 : 0);
    return id;
  }

  createTag(input: z.infer<typeof tagInputSchema>): string {
    const parsed = tagInputSchema.parse(input);
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO tag (id, dimension_id, name, parent_tag_id, created_at, updated_at, archived_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        `
      )
      .run(id, parsed.dimensionId, parsed.name, parsed.parentTagId ?? null);
    return id;
  }

  assignTagToEntity(input: z.infer<typeof tagAssignmentInputSchema>): string {
    const parsed = tagAssignmentInputSchema.parse(input);
    const dimension = this.db
      .prepare("SELECT mode FROM dimension WHERE id = ?")
      .get(parsed.dimensionId) as { mode: "single_select" | "multi_select" } | undefined;

    if (!dimension) {
      throw new Error(`Dimension not found: ${parsed.dimensionId}`);
    }

    if (dimension.mode === "single_select") {
      const existing = this.db
        .prepare(
          `
            SELECT id, tag_id
            FROM tag_assignment
            WHERE entity_type = ?
              AND entity_id = ?
              AND dimension_id = ?
          `
        )
        .get(parsed.entityType, parsed.entityId, parsed.dimensionId) as
        | { id: string; tag_id: string }
        | undefined;

      if (existing && existing.tag_id !== parsed.tagId) {
        throw new Error("Single-select dimension already has an assigned tag.");
      }

      if (existing && existing.tag_id === parsed.tagId) {
        return existing.id;
      }
    } else {
      const duplicate = this.db
        .prepare(
          `
            SELECT id
            FROM tag_assignment
            WHERE entity_type = ?
              AND entity_id = ?
              AND tag_id = ?
          `
        )
        .get(parsed.entityType, parsed.entityId, parsed.tagId) as { id: string } | undefined;
      if (duplicate) {
        return duplicate.id;
      }
    }

    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO tag_assignment (
            id,
            entity_type,
            entity_id,
            dimension_id,
            tag_id,
            created_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `
      )
      .run(id, parsed.entityType, parsed.entityId, parsed.dimensionId, parsed.tagId);
    return id;
  }

  assertRequiredDimensionsSatisfied(entityType: string, entityId: string): void {
    const missing = this.db
      .prepare(
        `
          SELECT d.id, d.name
          FROM dimension d
          LEFT JOIN tag_assignment ta
            ON ta.dimension_id = d.id
           AND ta.entity_type = ?
           AND ta.entity_id = ?
          WHERE d.required = 1
          GROUP BY d.id, d.name
          HAVING COUNT(ta.id) = 0
        `
      )
      .all(entityType, entityId) as Array<{ id: string; name: string }>;

    if (missing.length > 0) {
      const names = missing.map((entry) => entry.name).join(", ");
      throw new Error(`Required dimensions missing: ${names}`);
    }
  }

  listEntityIdsByTagFilter(entityType: string, tagId: string): string[] {
    const rows = this.db
      .prepare(
        `
          SELECT entity_id
          FROM tag_assignment
          WHERE entity_type = ?
            AND tag_id = ?
        `
      )
      .all(entityType, tagId) as Array<{ entity_id: string }>;

    return rows.map((row) => row.entity_id);
  }
}

