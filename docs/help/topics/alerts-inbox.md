### Overview
Central triage queue for reminders, renewal deadlines, and operational follow-ups.

### Queue views
- Due soon: active, time-sensitive items requiring near-term action.
- Snoozed: temporarily deferred alerts with a resume date.
- Acked: acknowledged items retained for audit trace.
- All: combined view for broad review and handoffs.
- Start with `Due soon` unless you are doing historical review or handoff cleanup.

### Triage playbook
1. Start with `Due soon` and sort by nearest due date.
2. Open each row and confirm owner + linked entity.
3. Take one disposition per alert:
   - `Review` when additional context is needed.
   - `Ack` when action is complete and trace should remain.
   - `Snooze +7d` when deferring with an explicit revisit date.
   - `Open entity` for direct correction in source workspace.
4. Re-check queue counts after action batch.

### Row actions
- Review
- Ack
- Snooze until +7d
- Open entity
- `Review`:
  - Use when you need to inspect the issue before deciding.
- `Ack`:
  - Use only after a real action has been taken.
- `Snooze until +7d`:
  - Use when the issue is valid but intentionally deferred.
- `Open entity`:
  - Use when the fix lives in the source record rather than in the alert itself.

### Detail panel fields
- Message
- Due date
- Related entity
- Trigger reason
- Recommended next actions

### Alert lifecycle guidance
- Prefer `Ack` only after a concrete action is performed.
- Use snooze sparingly and with owner accountability.
- If alert repeats across cycles, treat as process-quality signal and escalate.

### Example triage
- Alert: contract renews in 20 days
- You still need business input
- Best next step:
  - open entity
  - confirm owner and renewal action
  - snooze only if a follow-up date is real and agreed

### Weekly operations checkpoint
- Clear overdue and due-soon items.
- Confirm high-risk alerts are owned.
- Track repeated trigger patterns and open remediation tasks.
