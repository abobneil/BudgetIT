import crypto from "node:crypto";

import type Database from "better-sqlite3-multiple-ciphers";
import { z } from "zod";

const updateExpenseAmountSchema = z.object({
  expenseLineId: z.string().min(1),
  newAmountMinor: z.number().int().nonnegative(),
  actor: z.string().min(1)
});

export type UpdateExpenseAmountInput = z.infer<typeof updateExpenseAmountSchema>;

export function updateExpenseLineAmountWithAudit(
  db: Database.Database,
  input: UpdateExpenseAmountInput
): void {
  const parsed = updateExpenseAmountSchema.parse(input);

  const before = db
    .prepare("SELECT amount_minor, currency, updated_at FROM expense_line WHERE id = ?")
    .get(parsed.expenseLineId) as
    | { amount_minor: number; currency: string; updated_at: string }
    | undefined;

  if (!before) {
    throw new Error(`Expense line not found: ${parsed.expenseLineId}`);
  }

  const now = new Date().toISOString();
  const after = {
    amount_minor: parsed.newAmountMinor,
    currency: before.currency,
    updated_at: now
  };

  const write = db.transaction(() => {
    db.prepare(
      `
        UPDATE expense_line
        SET amount_minor = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(parsed.newAmountMinor, now, parsed.expenseLineId);

    db.prepare(
      `
        INSERT INTO audit_log (
          id,
          actor,
          action,
          entity_type,
          entity_id,
          before_json,
          after_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      crypto.randomUUID(),
      parsed.actor,
      "expense_line.update_amount",
      "expense_line",
      parsed.expenseLineId,
      JSON.stringify(before),
      JSON.stringify(after),
      now
    );

    db.prepare(
      `
        UPDATE meta
        SET last_mutation_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `
    ).run(now);
  });

  write();
}

