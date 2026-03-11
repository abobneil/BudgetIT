import crypto from "node:crypto";

import type Database from "better-sqlite3-multiple-ciphers";
import { z } from "zod";

const SCENARIO_APPROVAL_STATUSES = ["draft", "reviewed", "approved"] as const;
const ISO_4217_CURRENCY_CODE = /^[A-Z]{3}$/;

function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase();
}

function isIso4217CurrencyCode(value: string): boolean {
  return ISO_4217_CURRENCY_CODE.test(value);
}

const vendorInputSchema = z.object({
  name: z.string().min(1),
  website: z.string().optional(),
  notes: z.string().optional(),
  ownerId: z.string().nullable().optional(),
  owner: z.string().optional(),
  annualSpendMinor: z.number().int().nonnegative().default(0),
  status: z.enum(["active", "watch", "archived"]).default("active"),
  risk: z.enum(["low", "medium", "high"]).default("low")
});

const serviceInputSchema = z.object({
  vendorId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["active", "trial", "deprecated", "retiring", "retired"]),
  ownerId: z.string().nullable().optional(),
  ownerTeam: z.string().optional(),
  annualSpendMinor: z.number().int().nonnegative().default(0),
  risk: z.enum(["low", "medium", "high"]).default("low"),
  replacementStatus: z.enum(["not-started", "candidate-review", "approved"]).default("not-started")
});

const contractInputSchema = z.object({
  serviceId: z.string().min(1),
  contractNumber: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  renewalType: z.enum(["auto", "manual", "none"]).optional(),
  renewalDate: z.string().optional(),
  noticePeriodDays: z.number().int().nonnegative().optional(),
  ownerId: z.string().nullable().optional(),
  owner: z.string().optional(),
  lifecycleStatus: z.enum(["active", "renewal-window", "notice-window", "expired"]).default("active"),
  renewalAction: z.enum(["auto-renew", "manual-review", "cancel-window"]).default("manual-review")
});

const currencyCodeSchema = z
  .string()
  .trim()
  .transform((value) => normalizeCurrencyCode(value))
  .refine((value) => isIso4217CurrencyCode(value), {
    message: "currency must be a valid ISO 4217 code."
  });

const expenseLineInputSchema = z.object({
  scenarioId: z.string().min(1),
  serviceId: z.string().min(1),
  contractId: z.string().nullable().optional(),
  name: z.string().min(1),
  expenseType: z.enum(["recurring", "one_time"]),
  status: z.enum(["planned", "approved", "committed", "actual", "cancelled"]),
  amountMinor: z.number().int().nonnegative(),
  currency: currencyCodeSchema,
  capexOpex: z.enum(["capex", "opex"]).nullable().optional(),
  glAccountCode: z.string().nullable().optional(),
  costCenterCode: z.string().nullable().optional(),
  fundingSource: z.string().nullable().optional(),
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

const tagUpdateInputSchema = z.object({
  name: z.string().min(1),
  parentTagId: z.string().nullable().optional()
});

const tagAssignmentInputSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  dimensionId: z.string().min(1),
  tagId: z.string().min(1)
});

const scenarioInputSchema = z.object({
  name: z.string().min(1),
  parentScenarioId: z.string().nullable().optional(),
  approvalStatus: z.enum(SCENARIO_APPROVAL_STATUSES).default("draft")
});

const scenarioSettingsInputSchema = z.object({
  scenarioId: z.string().min(1),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
  horizonMonths: z.number().int().min(1).max(60).default(24),
  defaultCurrency: currencyCodeSchema.default("USD")
});

const costCenterInputSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean().default(true)
});

const glAccountInputSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  active: z.boolean().default(true)
});

export type VendorRecord = {
  id: string;
  name: string;
  website: string | null;
  notes: string | null;
  ownerId: string | null;
  owner: string | null;
  annualSpendMinor: number;
  status: "active" | "watch" | "archived";
  risk: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ServiceRecord = {
  id: string;
  vendorId: string;
  name: string;
  status: string;
  ownerId: string | null;
  ownerTeam: string | null;
  annualSpendMinor: number;
  risk: "low" | "medium" | "high";
  replacementStatus: "not-started" | "candidate-review" | "approved";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ContractRecord = {
  id: string;
  serviceId: string;
  contractNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalType: "auto" | "manual" | "none" | null;
  renewalDate: string | null;
  noticePeriodDays: number | null;
  ownerId: string | null;
  owner: string | null;
  lifecycleStatus: "active" | "renewal-window" | "notice-window" | "expired";
  renewalAction: "auto-renew" | "manual-review" | "cancel-window";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type ExpenseLineRecord = {
  id: string;
  scenarioId: string;
  serviceId: string;
  contractId: string | null;
  name: string;
  expenseType: "recurring" | "one_time";
  status: "planned" | "approved" | "committed" | "actual" | "cancelled";
  amountMinor: number;
  currency: string;
  capexOpex: "capex" | "opex" | null;
  glAccountCode: string | null;
  costCenterCode: string | null;
  fundingSource: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type RecurrenceRuleRecord = {
  id: string;
  expenseLineId: string;
  frequency: "monthly" | "quarterly" | "yearly";
  interval: number;
  dayOfMonth: number;
  monthOfYear: number | null;
  anchorDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DimensionRecord = {
  id: string;
  name: string;
  mode: "single_select" | "multi_select";
  required: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TagRecord = {
  id: string;
  dimensionId: string;
  name: string;
  parentTagId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type TagAssignmentRecord = {
  id: string;
  entityType: string;
  entityId: string;
  dimensionId: string;
  tagId: string;
  createdAt: string;
};

export type ScenarioRecord = {
  id: string;
  name: string;
  parentScenarioId: string | null;
  approvalStatus: "draft" | "reviewed" | "approved";
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScenarioSettingsRecord = {
  scenarioId: string;
  fiscalYearStartMonth: number;
  horizonMonths: number;
  defaultCurrency: string;
  createdAt: string;
  updatedAt: string;
};

export type CostCenterRecord = {
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GlAccountRecord = {
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DatabaseResetResult = {
  resetAt: string;
  preservedVendorCount: number;
  preservedOwnerCount: number;
  cleared: Record<string, number>;
};

export type OwnerOptionRecord = {
  id: string;
  name: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  vendorCount: number;
  serviceCount: number;
  contractCount: number;
};

export type OwnerUsageRecord = {
  owner: OwnerOptionRecord;
  vendors: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
  contracts: Array<{ id: string; contractNumber: string | null }>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeOwnerName(value: string): string {
  return value.trim().toLowerCase();
}

export function toCurrencyMinorUnits(value: number | string): number {
  const text =
    typeof value === "number" ? value.toFixed(2) : value.trim().replace(/^\$/, "");

  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) {
    throw new Error(`Invalid amount: ${value}`);
  }

  const isNegative = text.startsWith("-");
  const normalized = isNegative ? text.slice(1) : text;
  const [whole, fractional = ""] = normalized.split(".");
  const cents = `${fractional}00`.slice(0, 2);
  const minorUnits = Number.parseInt(whole, 10) * 100 + Number.parseInt(cents, 10);
  return isNegative ? -minorUnits : minorUnits;
}

export function toUsdMinorUnits(value: number | string): number {
  return toCurrencyMinorUnits(value);
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

  private assertScenarioMutable(scenarioId: string): void {
    const row = this.db
      .prepare("SELECT is_locked FROM scenario WHERE id = ?")
      .get(scenarioId) as { is_locked: number } | undefined;

    if (!row) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }
    if (row.is_locked === 1) {
      throw new Error(`Scenario is locked: ${scenarioId}`);
    }
  }

  private getOwnerNameById(ownerId: string): string {
    const row = this.db
      .prepare("SELECT name FROM owner_directory WHERE id = ?")
      .get(ownerId) as { name: string } | undefined;
    if (!row) {
      throw new Error(`Owner not found: ${ownerId}`);
    }
    return row.name;
  }

  private resolveOwnerReference(ownerId?: string | null, ownerName?: string | null): {
    ownerId: string | null;
    ownerName: string | null;
  } {
    if (ownerId && ownerId.trim().length > 0) {
      return {
        ownerId,
        ownerName: this.getOwnerNameById(ownerId)
      };
    }
    if (ownerName && ownerName.trim().length > 0) {
      const resolved = this.createOwner(ownerName);
      return {
        ownerId: resolved.id,
        ownerName: resolved.name
      };
    }
    return {
      ownerId: null,
      ownerName: null
    };
  }

  private buildOwnerUsage(ownerId: string): OwnerUsageRecord {
    const owner = this.db
      .prepare(
        `
          SELECT
            od.id,
            od.name,
            od.archived_at AS archivedAt,
            od.created_at AS createdAt,
            od.updated_at AS updatedAt,
            (
              SELECT COUNT(*)
              FROM vendor v
              WHERE v.owner_id = od.id AND v.deleted_at IS NULL
            ) AS vendorCount,
            (
              SELECT COUNT(*)
              FROM service s
              WHERE s.owner_id = od.id AND s.deleted_at IS NULL
            ) AS serviceCount,
            (
              SELECT COUNT(*)
              FROM contract c
              WHERE c.owner_id = od.id AND c.deleted_at IS NULL
            ) AS contractCount
          FROM owner_directory od
          WHERE od.id = ?
        `
      )
      .get(ownerId) as OwnerOptionRecord | undefined;

    if (!owner) {
      throw new Error(`Owner not found: ${ownerId}`);
    }

    const vendors = this.db
      .prepare(
        `
          SELECT id, name
          FROM vendor
          WHERE owner_id = ? AND deleted_at IS NULL
          ORDER BY name
        `
      )
      .all(ownerId) as Array<{ id: string; name: string }>;
    const services = this.db
      .prepare(
        `
          SELECT id, name
          FROM service
          WHERE owner_id = ? AND deleted_at IS NULL
          ORDER BY name
        `
      )
      .all(ownerId) as Array<{ id: string; name: string }>;
    const contracts = this.db
      .prepare(
        `
          SELECT id, contract_number AS contractNumber
          FROM contract
          WHERE owner_id = ? AND deleted_at IS NULL
          ORDER BY contract_number, id
        `
      )
      .all(ownerId) as Array<{ id: string; contractNumber: string | null }>;

    return {
      owner,
      vendors,
      services,
      contracts
    };
  }

  listOwners(includeArchived: boolean = false): OwnerOptionRecord[] {
    const whereClause = includeArchived ? "" : "WHERE od.archived_at IS NULL";
    return this.db
      .prepare(
        `
          SELECT
            od.id,
            od.name,
            od.archived_at AS archivedAt,
            od.created_at AS createdAt,
            od.updated_at AS updatedAt,
            (
              SELECT COUNT(*)
              FROM vendor v
              WHERE v.owner_id = od.id AND v.deleted_at IS NULL
            ) AS vendorCount,
            (
              SELECT COUNT(*)
              FROM service s
              WHERE s.owner_id = od.id AND s.deleted_at IS NULL
            ) AS serviceCount,
            (
              SELECT COUNT(*)
              FROM contract c
              WHERE c.owner_id = od.id AND c.deleted_at IS NULL
            ) AS contractCount
          FROM owner_directory od
          ${whereClause}
          ORDER BY od.name
        `
      )
      .all() as OwnerOptionRecord[];
  }

  createOwner(name: string): OwnerOptionRecord {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Owner name is required.");
    }
    const normalizedName = normalizeOwnerName(trimmed);
    const existing = this.db
      .prepare(
        `
          SELECT id
          FROM owner_directory
          WHERE normalized_name = ?
        `
      )
      .get(normalizedName) as { id: string } | undefined;

    if (existing) {
      this.db
        .prepare(
          `
            UPDATE owner_directory
            SET name = ?,
                archived_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
        )
        .run(trimmed, existing.id);
      return this.buildOwnerUsage(existing.id).owner;
    }

    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO owner_directory (
            id,
            name,
            normalized_name,
            archived_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
      )
      .run(id, trimmed, normalizedName);
    return this.buildOwnerUsage(id).owner;
  }

  getOwnerUsage(ownerId: string): OwnerUsageRecord {
    return this.buildOwnerUsage(ownerId);
  }

  retireOwner(ownerId: string, replacementOwnerId?: string | null): OwnerUsageRecord {
    const apply = this.db.transaction(() => {
      const usage = this.buildOwnerUsage(ownerId);
      const totalUsage =
        usage.owner.vendorCount + usage.owner.serviceCount + usage.owner.contractCount;

      if (totalUsage > 0) {
        if (!replacementOwnerId || replacementOwnerId === ownerId) {
          throw new Error(
            `Owner remap required for ${usage.owner.name}: ${usage.owner.vendorCount} vendors, ${usage.owner.serviceCount} services, ${usage.owner.contractCount} contracts.`
          );
        }
        const replacementName = this.getOwnerNameById(replacementOwnerId);
        this.db
          .prepare(
            `
              UPDATE vendor
              SET owner_id = ?,
                  owner = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE owner_id = ? AND deleted_at IS NULL
            `
          )
          .run(replacementOwnerId, replacementName, ownerId);
        this.db
          .prepare(
            `
              UPDATE service
              SET owner_id = ?,
                  owner_team = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE owner_id = ? AND deleted_at IS NULL
            `
          )
          .run(replacementOwnerId, replacementName, ownerId);
        this.db
          .prepare(
            `
              UPDATE contract
              SET owner_id = ?,
                  owner = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE owner_id = ? AND deleted_at IS NULL
            `
          )
          .run(replacementOwnerId, replacementName, ownerId);
      }

      this.db
        .prepare(
          `
            UPDATE owner_directory
            SET archived_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
        )
        .run(ownerId);
    });

    apply();
    return this.buildOwnerUsage(ownerId);
  }

  createVendor(input: z.input<typeof vendorInputSchema>): string {
    const parsed = vendorInputSchema.parse(input);
    const ownerRef = this.resolveOwnerReference(parsed.ownerId, parsed.owner);
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO vendor (
            id,
            name,
            website,
            notes,
            owner_id,
            owner,
            annual_spend_minor,
            status,
            risk,
            created_at,
            updated_at,
            deleted_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        `
      )
      .run(
        id,
        parsed.name,
        parsed.website ?? null,
        parsed.notes ?? null,
        ownerRef.ownerId,
        ownerRef.ownerName,
        parsed.annualSpendMinor,
        parsed.status,
        parsed.risk
      );
    return id;
  }

  updateVendor(id: string, input: z.input<typeof vendorInputSchema>): void {
    const parsed = vendorInputSchema.parse(input);
    const ownerRef = this.resolveOwnerReference(parsed.ownerId, parsed.owner);
    this.db
      .prepare(
        `
          UPDATE vendor
          SET name = ?,
              website = ?,
              notes = ?,
              owner_id = ?,
              owner = ?,
              annual_spend_minor = ?,
              status = ?,
              risk = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL
        `
      )
      .run(
        parsed.name,
        parsed.website ?? null,
        parsed.notes ?? null,
        ownerRef.ownerId,
        ownerRef.ownerName,
        parsed.annualSpendMinor,
        parsed.status,
        parsed.risk,
        id
      );
  }

  deleteVendor(id: string): void {
    this.db
      .prepare("UPDATE vendor SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);
  }

  createService(input: z.input<typeof serviceInputSchema>): string {
    const parsed = serviceInputSchema.parse(input);
    const ownerRef = this.resolveOwnerReference(parsed.ownerId, parsed.ownerTeam);
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO service (
            id,
            vendor_id,
            name,
            status,
            owner_id,
            owner_team,
            annual_spend_minor,
            risk,
            replacement_status,
            created_at,
            updated_at,
            deleted_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        `
      )
      .run(
        id,
        parsed.vendorId,
        parsed.name,
        parsed.status,
        ownerRef.ownerId,
        ownerRef.ownerName,
        parsed.annualSpendMinor,
        parsed.risk,
        parsed.replacementStatus
      );
    return id;
  }

  updateService(id: string, input: z.input<typeof serviceInputSchema>): void {
    const parsed = serviceInputSchema.parse(input);
    const ownerRef = this.resolveOwnerReference(parsed.ownerId, parsed.ownerTeam);
    this.db
      .prepare(
        `
          UPDATE service
          SET vendor_id = ?,
              name = ?,
              status = ?,
              owner_id = ?,
              owner_team = ?,
              annual_spend_minor = ?,
              risk = ?,
              replacement_status = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND deleted_at IS NULL
        `
      )
      .run(
        parsed.vendorId,
        parsed.name,
        parsed.status,
        ownerRef.ownerId,
        ownerRef.ownerName,
        parsed.annualSpendMinor,
        parsed.risk,
        parsed.replacementStatus,
        id
      );
  }

  deleteService(id: string): void {
    this.db
      .prepare("UPDATE service SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);
  }

  createContract(input: z.input<typeof contractInputSchema>): string {
    const parsed = contractInputSchema.parse(input);
    const ownerRef = this.resolveOwnerReference(parsed.ownerId, parsed.owner);
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
            owner_id,
            owner,
            lifecycle_status,
            renewal_action,
            created_at,
            updated_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
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
        parsed.noticePeriodDays ?? null,
        ownerRef.ownerId,
        ownerRef.ownerName,
        parsed.lifecycleStatus,
        parsed.renewalAction
      );
    return id;
  }

  updateContract(id: string, input: z.input<typeof contractInputSchema>): void {
    const parsed = contractInputSchema.parse(input);
    const ownerRef = this.resolveOwnerReference(parsed.ownerId, parsed.owner);
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
               owner_id = ?,
               owner = ?,
               lifecycle_status = ?,
               renewal_action = ?,
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
        ownerRef.ownerId,
        ownerRef.ownerName,
        parsed.lifecycleStatus,
        parsed.renewalAction,
        id
      );
  }

  deleteContract(id: string): void {
    this.db
      .prepare("UPDATE contract SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);
  }

  createExpenseLineWithOptionalRecurrence(
    expenseInput: z.input<typeof expenseLineInputSchema>,
    recurrenceInput?: z.input<typeof recurrenceRuleInputSchema>
  ): string {
    const parsedExpense = expenseLineInputSchema.parse(expenseInput);
    this.assertScenarioMutable(parsedExpense.scenarioId);
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
              capex_opex,
              gl_account_code,
              cost_center_code,
              funding_source,
              start_date,
              end_date,
              created_at,
              updated_at,
              deleted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
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
          parsedExpense.capexOpex ?? null,
          parsedExpense.glAccountCode ?? null,
          parsedExpense.costCenterCode ?? null,
          parsedExpense.fundingSource ?? null,
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

  updateExpenseLine(id: string, input: z.input<typeof expenseLineInputSchema>): void {
    const parsed = expenseLineInputSchema.parse(input);
    this.assertScenarioMutable(parsed.scenarioId);
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
              capex_opex = ?,
              gl_account_code = ?,
              cost_center_code = ?,
              funding_source = ?,
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
        parsed.capexOpex ?? null,
        parsed.glAccountCode ?? null,
        parsed.costCenterCode ?? null,
        parsed.fundingSource ?? null,
        parsed.startDate ?? null,
        parsed.endDate ?? null,
        nowIso(),
        id
      );
    this.touchForecastStale();
  }

  deleteExpenseLine(id: string): void {
    const row = this.db
      .prepare("SELECT scenario_id FROM expense_line WHERE id = ?")
      .get(id) as { scenario_id: string } | undefined;
    if (!row) {
      throw new Error(`Expense line not found: ${id}`);
    }
    this.assertScenarioMutable(row.scenario_id);

    this.db
      .prepare("UPDATE expense_line SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);
    this.touchForecastStale();
  }

  createRecurrenceRule(input: z.input<typeof recurrenceRuleInputSchema>): string {
    const parsed = recurrenceRuleInputSchema.parse(input);
    const expense = this.db
      .prepare("SELECT scenario_id FROM expense_line WHERE id = ?")
      .get(parsed.expenseLineId) as { scenario_id: string } | undefined;
    if (!expense) {
      throw new Error(`Expense line not found: ${parsed.expenseLineId}`);
    }
    this.assertScenarioMutable(expense.scenario_id);

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

  updateRecurrenceRule(id: string, input: z.input<typeof recurrenceRuleInputSchema>): void {
    const parsed = recurrenceRuleInputSchema.parse(input);
    const expense = this.db
      .prepare("SELECT scenario_id FROM expense_line WHERE id = ?")
      .get(parsed.expenseLineId) as { scenario_id: string } | undefined;
    if (!expense) {
      throw new Error(`Expense line not found: ${parsed.expenseLineId}`);
    }
    this.assertScenarioMutable(expense.scenario_id);

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
    const scenario = this.db
      .prepare(
        `
          SELECT e.scenario_id
          FROM recurrence_rule r
          JOIN expense_line e ON e.id = r.expense_line_id
          WHERE r.id = ?
        `
      )
      .get(id) as { scenario_id: string } | undefined;
    if (!scenario) {
      throw new Error(`Recurrence rule not found: ${id}`);
    }
    this.assertScenarioMutable(scenario.scenario_id);

    this.db.prepare("DELETE FROM recurrence_rule WHERE id = ?").run(id);
    this.touchForecastStale();
  }

  createScenario(input: z.input<typeof scenarioInputSchema>): string {
    const parsed = scenarioInputSchema.parse(input);
    if (parsed.parentScenarioId) {
      const parent = this.db
        .prepare("SELECT id FROM scenario WHERE id = ?")
        .get(parsed.parentScenarioId) as { id: string } | undefined;
      if (!parent) {
        throw new Error(`Scenario not found: ${parsed.parentScenarioId}`);
      }
    }
    const id = crypto.randomUUID();
    const create = this.db.transaction(() => {
      this.db
        .prepare(
          `
            INSERT INTO scenario (
              id,
              name,
              parent_scenario_id,
              approval_status,
              is_locked,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(id, parsed.name, parsed.parentScenarioId ?? null, parsed.approvalStatus);

      const parentSettings =
        parsed.parentScenarioId
          ? (this.db
              .prepare(
                `
                  SELECT
                    fiscal_year_start_month,
                    horizon_months,
                    default_currency
                  FROM scenario_settings
                  WHERE scenario_id = ?
                `
              )
              .get(parsed.parentScenarioId) as
              | {
                  fiscal_year_start_month: number;
                  horizon_months: number;
                  default_currency: string;
                }
              | undefined)
          : undefined;
      this.db
        .prepare(
          `
            INSERT INTO scenario_settings (
              scenario_id,
              fiscal_year_start_month,
              horizon_months,
              default_currency,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(
          id,
          parentSettings?.fiscal_year_start_month ?? 1,
          parentSettings?.horizon_months ?? 24,
          parentSettings?.default_currency ?? "USD"
        );
    });
    create();
    return id;
  }

  deleteScenario(scenarioId: string): void {
    const scenario = this.db
      .prepare("SELECT id FROM scenario WHERE id = ?")
      .get(scenarioId) as
      | {
          id: string;
        }
      | undefined;

    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }
    if (scenario.id === "baseline") {
      throw new Error("Baseline scenario cannot be deleted.");
    }

    const childScenario = this.db
      .prepare("SELECT id FROM scenario WHERE parent_scenario_id = ? LIMIT 1")
      .get(scenarioId) as { id: string } | undefined;
    if (childScenario) {
      throw new Error("Scenario cannot be deleted while child scenarios exist.");
    }

    const remove = this.db.transaction(() => {
      this.db
        .prepare(
          `
            DELETE FROM capability_assignment
            WHERE entity_type = 'replacement_candidate'
              AND entity_id IN (
                SELECT id
                FROM replacement_candidate
                WHERE service_plan_id IN (
                  SELECT id
                  FROM service_plan
                  WHERE scenario_id = ?
                )
              )
          `
        )
        .run(scenarioId);
      this.db
        .prepare(
          `
            DELETE FROM service_plan_source_item
            WHERE service_plan_id IN (
              SELECT id
              FROM service_plan
              WHERE scenario_id = ?
            )
          `
        )
        .run(scenarioId);
      this.db
        .prepare(
          `
            DELETE FROM replacement_candidate
            WHERE service_plan_id IN (
              SELECT id
              FROM service_plan
              WHERE scenario_id = ?
            )
          `
        )
        .run(scenarioId);
      this.db.prepare("DELETE FROM service_plan WHERE scenario_id = ?").run(scenarioId);
      this.db.prepare("DELETE FROM renewal_decision WHERE scenario_id = ?").run(scenarioId);
      this.db.prepare("DELETE FROM alert_event WHERE scenario_id = ?").run(scenarioId);
      this.db.prepare("DELETE FROM alert_rule WHERE scenario_id = ?").run(scenarioId);
      this.db.prepare("DELETE FROM occurrence WHERE scenario_id = ?").run(scenarioId);
      this.db.prepare("DELETE FROM spend_transaction WHERE scenario_id = ?").run(scenarioId);
      this.db.prepare("DELETE FROM unmatched_actual_review WHERE scenario_id = ?").run(scenarioId);
      this.db
        .prepare(
          `
            DELETE FROM showback_line
            WHERE statement_id IN (
              SELECT id
              FROM showback_statement
              WHERE scenario_id = ?
            )
          `
        )
        .run(scenarioId);
      this.db.prepare("DELETE FROM showback_statement WHERE scenario_id = ?").run(scenarioId);
      this.db.prepare("DELETE FROM approval_record WHERE scenario_id = ?").run(scenarioId);
      this.db.prepare("DELETE FROM scenario_settings WHERE scenario_id = ?").run(scenarioId);
      this.db
        .prepare(
          `
            DELETE FROM recurrence_rule
            WHERE expense_line_id IN (
              SELECT id
              FROM expense_line
              WHERE scenario_id = ?
            )
          `
        )
        .run(scenarioId);
      this.db
        .prepare(
          `
            DELETE FROM capability_assignment
            WHERE entity_type = 'expense_line'
              AND entity_id IN (
                SELECT id
                FROM expense_line
                WHERE scenario_id = ?
              )
          `
        )
        .run(scenarioId);
      this.db.prepare("DELETE FROM expense_line WHERE scenario_id = ?").run(scenarioId);
      this.db.prepare("DELETE FROM scenario WHERE id = ?").run(scenarioId);
      this.touchForecastStale();
    });

    remove();
  }

  setScenarioApprovalStatus(
    scenarioId: string,
    nextStatus: "draft" | "reviewed" | "approved"
  ): void {
    const current = this.db
      .prepare("SELECT approval_status FROM scenario WHERE id = ?")
      .get(scenarioId) as { approval_status: "draft" | "reviewed" | "approved" } | undefined;

    if (!current) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    const validTransitions: Record<string, Array<string>> = {
      draft: ["reviewed"],
      reviewed: ["approved", "draft"],
      approved: []
    };

    if (!validTransitions[current.approval_status].includes(nextStatus)) {
      throw new Error(
        `Invalid scenario approval transition: ${current.approval_status} -> ${nextStatus}`
      );
    }

    this.db
      .prepare("UPDATE scenario SET approval_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(nextStatus, scenarioId);
  }

  lockScenario(scenarioId: string): void {
    this.db
      .prepare("UPDATE scenario SET is_locked = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(scenarioId);
  }

  cloneScenario(sourceScenarioId: string, newScenarioName: string): string {
    const source = this.db
      .prepare("SELECT id FROM scenario WHERE id = ?")
      .get(sourceScenarioId) as { id: string } | undefined;
    if (!source) {
      throw new Error(`Scenario not found: ${sourceScenarioId}`);
    }

    const newScenarioId = crypto.randomUUID();
    const clone = this.db.transaction(() => {
      this.db
        .prepare(
          `
            INSERT INTO scenario (
              id,
              name,
              parent_scenario_id,
              approval_status,
              is_locked,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, 'draft', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(newScenarioId, newScenarioName, sourceScenarioId);

      const sourceExpenses = this.db
        .prepare(
          `
            SELECT
              id,
              service_id,
              contract_id,
              name,
              expense_type,
              status,
              amount_minor,
              currency,
              capex_opex,
              gl_account_code,
              cost_center_code,
              funding_source,
              start_date,
              end_date,
              created_at,
              updated_at,
              deleted_at
            FROM expense_line
            WHERE scenario_id = ?
              AND deleted_at IS NULL
          `
        )
        .all(sourceScenarioId) as Array<{
        id: string;
        service_id: string;
        contract_id: string | null;
        name: string;
        expense_type: string;
        status: string;
        amount_minor: number;
        currency: string;
        capex_opex: "capex" | "opex" | null;
        gl_account_code: string | null;
        cost_center_code: string | null;
        funding_source: string | null;
        start_date: string | null;
        end_date: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }>;

      const expenseMap = new Map<string, string>();
      const insertExpense = this.db.prepare(
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
            capex_opex,
            gl_account_code,
            cost_center_code,
            funding_source,
            start_date,
            end_date,
            created_at,
            updated_at,
            deleted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      );

      for (const expense of sourceExpenses) {
        const clonedExpenseId = crypto.randomUUID();
        expenseMap.set(expense.id, clonedExpenseId);
        insertExpense.run(
          clonedExpenseId,
          newScenarioId,
          expense.service_id,
          expense.contract_id,
          expense.name,
          expense.expense_type,
          expense.status,
          expense.amount_minor,
          expense.currency,
          expense.capex_opex,
          expense.gl_account_code,
          expense.cost_center_code,
          expense.funding_source,
          expense.start_date,
          expense.end_date,
          expense.created_at,
          expense.updated_at,
          expense.deleted_at
        );
      }

      const sourceSettings = this.db
        .prepare(
          `
            SELECT
              fiscal_year_start_month,
              horizon_months,
              default_currency
            FROM scenario_settings
            WHERE scenario_id = ?
          `
        )
        .get(sourceScenarioId) as
        | {
            fiscal_year_start_month: number;
            horizon_months: number;
            default_currency: string;
          }
        | undefined;
      this.db
        .prepare(
          `
            INSERT INTO scenario_settings (
              scenario_id,
              fiscal_year_start_month,
              horizon_months,
              default_currency,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `
        )
        .run(
          newScenarioId,
          sourceSettings?.fiscal_year_start_month ?? 1,
          sourceSettings?.horizon_months ?? 24,
          sourceSettings?.default_currency ?? "USD"
        );

      const sourceRecurrences = this.db
        .prepare(
          `
            SELECT id, expense_line_id, frequency, interval, day_of_month, month_of_year, anchor_date
            FROM recurrence_rule
            WHERE expense_line_id IN (
              SELECT id FROM expense_line WHERE scenario_id = ? AND deleted_at IS NULL
            )
          `
        )
        .all(sourceScenarioId) as Array<{
        id: string;
        expense_line_id: string;
        frequency: string;
        interval: number;
        day_of_month: number;
        month_of_year: number | null;
        anchor_date: string | null;
      }>;

      const insertRecurrence = this.db.prepare(
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
      );

      for (const recurrence of sourceRecurrences) {
        const clonedExpenseId = expenseMap.get(recurrence.expense_line_id);
        if (!clonedExpenseId) {
          continue;
        }
        insertRecurrence.run(
          crypto.randomUUID(),
          clonedExpenseId,
          recurrence.frequency,
          recurrence.interval,
          recurrence.day_of_month,
          recurrence.month_of_year,
          recurrence.anchor_date
        );
      }

      const sourceRenewalDecisions = this.db
        .prepare(
          `
            SELECT
              id,
              service_id,
              contract_id,
              action,
              effective_date,
              current_amount_minor,
              expected_amount_minor,
              recurring_savings_minor,
              avoided_future_cost_minor,
              one_time_cost_minor,
              savings_category,
              savings_rationale,
              currency,
              notes,
              assumptions,
              source_snapshot_json,
              materialized_expense_line_id
            FROM renewal_decision
            WHERE scenario_id = ?
          `
        )
        .all(sourceScenarioId) as Array<{
        id: string;
        service_id: string;
        contract_id: string | null;
        action: string;
        effective_date: string;
        current_amount_minor: number;
        expected_amount_minor: number;
        recurring_savings_minor: number;
        avoided_future_cost_minor: number;
        one_time_cost_minor: number;
        savings_category: string | null;
        savings_rationale: string | null;
        currency: string;
        notes: string | null;
        assumptions: string | null;
        source_snapshot_json: string;
        materialized_expense_line_id: string | null;
      }>;

      const insertRenewalDecision = this.db.prepare(
        `
          INSERT INTO renewal_decision (
            id,
            scenario_id,
            service_id,
            contract_id,
            action,
            effective_date,
            current_amount_minor,
            expected_amount_minor,
            recurring_savings_minor,
            avoided_future_cost_minor,
            one_time_cost_minor,
            savings_category,
            savings_rationale,
            currency,
            notes,
            assumptions,
            source_snapshot_json,
            materialized_expense_line_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `
      );

      for (const decision of sourceRenewalDecisions) {
        let snapshotJson = decision.source_snapshot_json;
        try {
          const parsed = JSON.parse(decision.source_snapshot_json) as Array<{
            expenseLineId: string;
            originalEndDate: string | null;
          }>;
          snapshotJson = JSON.stringify(
            parsed.map((entry) => ({
              ...entry,
              expenseLineId: expenseMap.get(entry.expenseLineId) ?? entry.expenseLineId
            }))
          );
        } catch {
          snapshotJson = decision.source_snapshot_json;
        }
        insertRenewalDecision.run(
          crypto.randomUUID(),
          newScenarioId,
          decision.service_id,
          decision.contract_id,
          decision.action,
          decision.effective_date,
          decision.current_amount_minor,
          decision.expected_amount_minor,
          decision.recurring_savings_minor,
          decision.avoided_future_cost_minor,
          decision.one_time_cost_minor,
          decision.savings_category,
          decision.savings_rationale,
          decision.currency,
          decision.notes,
          decision.assumptions,
          snapshotJson,
          decision.materialized_expense_line_id
            ? (expenseMap.get(decision.materialized_expense_line_id) ?? null)
            : null
        );
      }
    });

    clone();
    return newScenarioId;
  }

  createDimension(input: z.input<typeof dimensionInputSchema>): string {
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

  updateDimension(id: string, input: z.input<typeof dimensionInputSchema>): void {
    const parsed = dimensionInputSchema.parse(input);
    this.db
      .prepare(
        `
          UPDATE dimension
          SET name = ?, mode = ?, required = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      )
      .run(parsed.name, parsed.mode, parsed.required ? 1 : 0, id);
  }

  deleteDimension(id: string): void {
    const run = this.db.transaction(() => {
      this.db.prepare("DELETE FROM tag_assignment WHERE dimension_id = ?").run(id);
      this.db.prepare("DELETE FROM tag WHERE dimension_id = ?").run(id);
      this.db.prepare("DELETE FROM dimension WHERE id = ?").run(id);
    });
    run();
  }

  createTag(input: z.input<typeof tagInputSchema>): string {
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

  updateTag(id: string, input: z.input<typeof tagUpdateInputSchema>): void {
    const parsed = tagUpdateInputSchema.parse(input);
    this.db
      .prepare(
        `
          UPDATE tag
          SET name = ?, parent_tag_id = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      )
      .run(parsed.name, parsed.parentTagId ?? null, id);
  }

  archiveTag(id: string, archived: boolean): void {
    if (archived) {
      this.db
        .prepare(
          `
            UPDATE tag
            SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `
        )
        .run(id);
      return;
    }
    this.db
      .prepare(
        `
          UPDATE tag
          SET archived_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      )
      .run(id);
  }

  mergeTagAssignments(dimensionId: string, sourceTagId: string, targetTagId: string): number {
    if (sourceTagId === targetTagId) {
      return 0;
    }
    const run = this.db.transaction(() => {
      const deleted = this.db
        .prepare(
          `
            DELETE FROM tag_assignment
            WHERE dimension_id = ?
              AND tag_id = ?
              AND EXISTS (
                SELECT 1
                FROM tag_assignment t2
                WHERE t2.dimension_id = tag_assignment.dimension_id
                  AND t2.entity_type = tag_assignment.entity_type
                  AND t2.entity_id = tag_assignment.entity_id
                  AND t2.tag_id = ?
              )
          `
        )
        .run(dimensionId, sourceTagId, targetTagId);

      const updated = this.db
        .prepare(
          `
            UPDATE tag_assignment
            SET tag_id = ?
            WHERE dimension_id = ?
              AND tag_id = ?
          `
        )
        .run(targetTagId, dimensionId, sourceTagId);

      this.archiveTag(sourceTagId, true);
      return deleted.changes + updated.changes;
    });
    return run();
  }

  assignTagToEntity(input: z.input<typeof tagAssignmentInputSchema>): string {
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

  removeTagAssignment(
    entityType: string,
    entityId: string,
    dimensionId: string,
    tagId: string
  ): void {
    this.db
      .prepare(
        `
          DELETE FROM tag_assignment
          WHERE entity_type = ?
            AND entity_id = ?
            AND dimension_id = ?
            AND tag_id = ?
        `
      )
      .run(entityType, entityId, dimensionId, tagId);
  }

  listVendors(includeDeleted: boolean = false): VendorRecord[] {
    const whereClause = includeDeleted ? "" : "WHERE deleted_at IS NULL";
    return this.db
      .prepare(
        `
          SELECT
            id,
            name,
            website,
            notes,
            owner_id AS ownerId,
            owner,
            annual_spend_minor AS annualSpendMinor,
            status,
            risk,
            created_at AS createdAt,
            updated_at AS updatedAt,
            deleted_at AS deletedAt
          FROM vendor
          ${whereClause}
          ORDER BY name
        `
      )
      .all() as VendorRecord[];
  }

  listServices(includeDeleted: boolean = false): ServiceRecord[] {
    const whereClause = includeDeleted ? "" : "WHERE deleted_at IS NULL";
    return this.db
      .prepare(
        `
          SELECT
            id,
            vendor_id AS vendorId,
            name,
            status,
            owner_id AS ownerId,
            owner_team AS ownerTeam,
            annual_spend_minor AS annualSpendMinor,
            risk,
            replacement_status AS replacementStatus,
            created_at AS createdAt,
            updated_at AS updatedAt,
            deleted_at AS deletedAt
          FROM service
          ${whereClause}
          ORDER BY name
        `
      )
      .all() as ServiceRecord[];
  }

  listContracts(includeDeleted: boolean = false): ContractRecord[] {
    const whereClause = includeDeleted ? "" : "WHERE deleted_at IS NULL";
    return this.db
      .prepare(
        `
          SELECT
            id,
            service_id AS serviceId,
            contract_number AS contractNumber,
            start_date AS startDate,
            end_date AS endDate,
            renewal_type AS renewalType,
            renewal_date AS renewalDate,
            notice_period_days AS noticePeriodDays,
            owner_id AS ownerId,
            owner,
            lifecycle_status AS lifecycleStatus,
            renewal_action AS renewalAction,
            created_at AS createdAt,
            updated_at AS updatedAt,
            deleted_at AS deletedAt
          FROM contract
          ${whereClause}
          ORDER BY COALESCE(renewal_date, end_date, created_at)
        `
      )
      .all() as ContractRecord[];
  }

  listExpenseLines(scenarioId?: string, includeDeleted: boolean = false): ExpenseLineRecord[] {
    const clauses: string[] = [];
    const params: Array<string> = [];
    if (!includeDeleted) {
      clauses.push("deleted_at IS NULL");
    }
    if (scenarioId) {
      clauses.push("scenario_id = ?");
      params.push(scenarioId);
    }
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    return this.db
      .prepare(
        `
          SELECT
            id,
            scenario_id AS scenarioId,
            service_id AS serviceId,
            contract_id AS contractId,
            name,
            expense_type AS expenseType,
            status,
            amount_minor AS amountMinor,
            currency,
            capex_opex AS capexOpex,
            gl_account_code AS glAccountCode,
            cost_center_code AS costCenterCode,
            funding_source AS fundingSource,
            start_date AS startDate,
            end_date AS endDate,
            created_at AS createdAt,
            updated_at AS updatedAt,
            deleted_at AS deletedAt
          FROM expense_line
          ${whereClause}
          ORDER BY name
        `
      )
      .all(...params) as ExpenseLineRecord[];
  }

  listRecurrenceRules(expenseLineId?: string): RecurrenceRuleRecord[] {
    const whereClause = expenseLineId ? "WHERE expense_line_id = ?" : "";
    return this.db
      .prepare(
        `
          SELECT
            id,
            expense_line_id AS expenseLineId,
            frequency,
            interval,
            day_of_month AS dayOfMonth,
            month_of_year AS monthOfYear,
            anchor_date AS anchorDate,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM recurrence_rule
          ${whereClause}
          ORDER BY created_at
        `
      )
      .all(...(expenseLineId ? [expenseLineId] : [])) as RecurrenceRuleRecord[];
  }

  listDimensions(): DimensionRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            name,
            mode,
            required,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM dimension
          ORDER BY name
        `
      )
      .all() as Array<{
      id: string;
      name: string;
      mode: "single_select" | "multi_select";
      required: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((row) => ({
      ...row,
      required: row.required === 1
    }));
  }

  listTags(dimensionId?: string, includeArchived: boolean = false): TagRecord[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (dimensionId) {
      clauses.push("dimension_id = ?");
      params.push(dimensionId);
    }
    if (!includeArchived) {
      clauses.push("archived_at IS NULL");
    }
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    return this.db
      .prepare(
        `
          SELECT
            id,
            dimension_id AS dimensionId,
            name,
            parent_tag_id AS parentTagId,
            created_at AS createdAt,
            updated_at AS updatedAt,
            archived_at AS archivedAt
          FROM tag
          ${whereClause}
          ORDER BY name
        `
      )
      .all(...params) as TagRecord[];
  }

  listTagAssignments(entityType?: string, entityId?: string): TagAssignmentRecord[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (entityType) {
      clauses.push("entity_type = ?");
      params.push(entityType);
    }
    if (entityId) {
      clauses.push("entity_id = ?");
      params.push(entityId);
    }
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    return this.db
      .prepare(
        `
          SELECT
            id,
            entity_type AS entityType,
            entity_id AS entityId,
            dimension_id AS dimensionId,
            tag_id AS tagId,
            created_at AS createdAt
          FROM tag_assignment
          ${whereClause}
          ORDER BY created_at
        `
      )
      .all(...params) as TagAssignmentRecord[];
  }

  listScenarios(): ScenarioRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            id,
            name,
            parent_scenario_id AS parentScenarioId,
            approval_status AS approvalStatus,
            is_locked AS isLocked,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM scenario
          ORDER BY created_at
        `
      )
      .all() as Array<{
      id: string;
      name: string;
      parentScenarioId: string | null;
      approvalStatus: "draft" | "reviewed" | "approved";
      isLocked: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((row) => ({
      ...row,
      isLocked: row.isLocked === 1
    }));
  }

  getScenarioSettings(scenarioId: string): ScenarioSettingsRecord {
    const existing = this.db
      .prepare(
        `
          SELECT
            scenario_id AS scenarioId,
            fiscal_year_start_month AS fiscalYearStartMonth,
            horizon_months AS horizonMonths,
            default_currency AS defaultCurrency,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM scenario_settings
          WHERE scenario_id = ?
        `
      )
      .get(scenarioId) as ScenarioSettingsRecord | undefined;

    if (existing) {
      return existing;
    }

    this.upsertScenarioSettings({
      scenarioId,
      fiscalYearStartMonth: 1,
      horizonMonths: 24,
      defaultCurrency: "USD"
    });
    return this.getScenarioSettings(scenarioId);
  }

  upsertScenarioSettings(
    input: z.input<typeof scenarioSettingsInputSchema>
  ): ScenarioSettingsRecord {
    const parsed = scenarioSettingsInputSchema.parse(input);
    this.db
      .prepare(
        `
          INSERT INTO scenario_settings (
            scenario_id,
            fiscal_year_start_month,
            horizon_months,
            default_currency,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(scenario_id) DO UPDATE SET
            fiscal_year_start_month = excluded.fiscal_year_start_month,
            horizon_months = excluded.horizon_months,
            default_currency = excluded.default_currency,
            updated_at = CURRENT_TIMESTAMP
        `
      )
      .run(
        parsed.scenarioId,
        parsed.fiscalYearStartMonth,
        parsed.horizonMonths,
        parsed.defaultCurrency
      );
    return this.getScenarioSettings(parsed.scenarioId);
  }

  listCostCenters(): CostCenterRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            code,
            name,
            active,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM cost_center
          ORDER BY code
        `
      )
      .all() as Array<{
      code: string;
      name: string;
      active: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((row) => ({
      ...row,
      active: row.active === 1
    }));
  }

  upsertCostCenter(input: z.input<typeof costCenterInputSchema>): void {
    const parsed = costCenterInputSchema.parse(input);
    this.db
      .prepare(
        `
          INSERT INTO cost_center (code, name, active, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(code) DO UPDATE SET
            name = excluded.name,
            active = excluded.active,
            updated_at = CURRENT_TIMESTAMP
        `
      )
      .run(parsed.code, parsed.name, parsed.active ? 1 : 0);
  }

  deleteCostCenter(code: string): void {
    this.db.prepare("DELETE FROM cost_center WHERE code = ?").run(code);
  }

  listGlAccounts(): GlAccountRecord[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            code,
            name,
            active,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM gl_account
          ORDER BY code
        `
      )
      .all() as Array<{
      code: string;
      name: string;
      active: number;
      createdAt: string;
      updatedAt: string;
    }>;

    return rows.map((row) => ({
      ...row,
      active: row.active === 1
    }));
  }

  upsertGlAccount(input: z.input<typeof glAccountInputSchema>): void {
    const parsed = glAccountInputSchema.parse(input);
    this.db
      .prepare(
        `
          INSERT INTO gl_account (code, name, active, created_at, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(code) DO UPDATE SET
            name = excluded.name,
            active = excluded.active,
            updated_at = CURRENT_TIMESTAMP
        `
      )
      .run(parsed.code, parsed.name, parsed.active ? 1 : 0);
  }

  deleteGlAccount(code: string): void {
    this.db.prepare("DELETE FROM gl_account WHERE code = ?").run(code);
  }

  resetDatabase(): DatabaseResetResult {
    const resetAt = nowIso();
    const run = this.db.transaction(() => {
      const cleared: Record<string, number> = {};
      const deleteFromTable = (tableName: string, whereClause?: string): void => {
        const result = this.db.prepare(`DELETE FROM ${tableName}${whereClause ? ` ${whereClause}` : ""}`).run();
        cleared[tableName] = result.changes;
      };

      deleteFromTable("capability_assignment");
      deleteFromTable("service_plan_source_item");
      deleteFromTable("replacement_candidate");
      deleteFromTable("service_plan");
      deleteFromTable("capability");
      deleteFromTable("renewal_decision");
      deleteFromTable("unmatched_actual_review");
      deleteFromTable("showback_line");
      deleteFromTable("showback_statement");
      deleteFromTable("approval_record");
      deleteFromTable("notification_endpoint");
      deleteFromTable("attachment");
      deleteFromTable("spend_transaction");
      deleteFromTable("occurrence");
      deleteFromTable("recurrence_rule");
      deleteFromTable("expense_line");
      deleteFromTable("contract");
      deleteFromTable("service");
      deleteFromTable("vendor");
      deleteFromTable("tag_assignment");
      deleteFromTable("tag");
      deleteFromTable("dimension");
      deleteFromTable("alert_event");
      deleteFromTable("alert_rule");
      deleteFromTable("cost_center");
      deleteFromTable("gl_account");
      deleteFromTable("audit_log");

      const deleteScenarioSettings = this.db
        .prepare("DELETE FROM scenario_settings WHERE scenario_id <> 'baseline'")
        .run();
      cleared.scenario_settings = deleteScenarioSettings.changes;

      const deleteScenarios = this.db
        .prepare("DELETE FROM scenario WHERE id <> 'baseline'")
        .run();
      cleared.scenario = deleteScenarios.changes;

      const deleteOwners = this.db.prepare("DELETE FROM owner_directory").run();
      cleared.owner_directory = deleteOwners.changes;

      this.db
        .prepare(
          `
            INSERT INTO scenario (
              id,
              name,
              parent_scenario_id,
              approval_status,
              is_locked,
              created_at,
              updated_at
            ) VALUES ('baseline', 'Baseline', NULL, 'approved', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              parent_scenario_id = excluded.parent_scenario_id,
              approval_status = excluded.approval_status,
              is_locked = excluded.is_locked,
              updated_at = CURRENT_TIMESTAMP
          `
        )
        .run();

      this.db
        .prepare(
          `
            INSERT INTO scenario_settings (
              scenario_id,
              fiscal_year_start_month,
              horizon_months,
              default_currency,
              created_at,
              updated_at
            ) VALUES ('baseline', 1, 24, 'USD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(scenario_id) DO UPDATE SET
              fiscal_year_start_month = 1,
              horizon_months = 24,
              default_currency = 'USD',
              updated_at = CURRENT_TIMESTAMP
          `
        )
        .run();

      this.db
        .prepare(
          `
            UPDATE meta
            SET last_mutation_at = ?,
                forecast_stale = 1,
                forecast_generated_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
          `
        )
        .run(resetAt);

      return {
        resetAt,
        preservedVendorCount: 0,
        preservedOwnerCount: 0,
        cleared
      };
    });

    return run();
  }
}

