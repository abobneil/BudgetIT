import { useEffect, useState } from "react";

type RuntimeSettings = {
  startWithWindows: boolean;
  minimizeToTray: boolean;
};

const defaultSettings: RuntimeSettings = {
  startWithWindows: true,
  minimizeToTray: true
};

async function getSettings(): Promise<RuntimeSettings> {
  if (!window.budgetit) {
    return defaultSettings;
  }

  return (await window.budgetit.invoke("settings.get")) as RuntimeSettings;
}

async function saveSettings(settings: RuntimeSettings): Promise<RuntimeSettings> {
  if (!window.budgetit) {
    return settings;
  }

  return (await window.budgetit.invoke("settings.update", settings)) as RuntimeSettings;
}

export function App() {
  const [settings, setSettings] = useState<RuntimeSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Loaded defaults");
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([]);
  const [services, setServices] = useState<Array<{ id: string; vendorId: string; name: string }>>([]);
  const [contracts, setContracts] = useState<Array<{ id: string; serviceId: string; contractNumber: string }>>([]);
  const [expenses, setExpenses] = useState<
    Array<{ id: string; name: string; amountMinor: number; status: "planned" | "approved" | "committed" | "actual" | "cancelled" }>
  >([]);
  const [recurrences, setRecurrences] = useState<
    Array<{ id: string; expenseId: string; frequency: "monthly" | "quarterly" | "yearly"; dayOfMonth: number }>
  >([]);
  const [dimensions, setDimensions] = useState<
    Array<{ id: string; name: string; mode: "single_select" | "multi_select"; required: boolean }>
  >([]);
  const [tags, setTags] = useState<Array<{ id: string; dimensionId: string; name: string }>>([]);
  const [assignments, setAssignments] = useState<
    Array<{ entityType: "expense_line"; entityId: string; dimensionId: string; tagId: string }>
  >([]);
  const [vendorName, setVendorName] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmountMinor, setExpenseAmountMinor] = useState("0");
  const [recurrenceDay, setRecurrenceDay] = useState("1");
  const [dimensionName, setDimensionName] = useState("");
  const [dimensionMode, setDimensionMode] = useState<"single_select" | "multi_select">("single_select");
  const [dimensionRequired, setDimensionRequired] = useState(false);
  const [tagName, setTagName] = useState("");
  const [selectedFilterTagId, setSelectedFilterTagId] = useState("");

  useEffect(() => {
    void (async () => {
      const next = await getSettings();
      setSettings(next);
      setStatus("Runtime settings loaded");
    })();
  }, []);

  async function onSave(): Promise<void> {
    setSaving(true);
    const next = await saveSettings(settings);
    setSettings(next);
    setSaving(false);
    setStatus("Runtime settings saved");
  }

  function nextId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  const filteredExpenseIds =
    selectedFilterTagId.length > 0
      ? assignments
          .filter((entry) => entry.tagId === selectedFilterTagId && entry.entityType === "expense_line")
          .map((entry) => entry.entityId)
      : expenses.map((entry) => entry.id);

  return (
    <main className="app-shell">
      <header>
        <h1>BudgetIT</h1>
        <p>Tray and startup defaults are configurable.</p>
      </header>

      <section className="settings-panel">
        <label>
          <input
            type="checkbox"
            checked={settings.startWithWindows}
            onChange={(event) => {
              setSettings((current) => ({
                ...current,
                startWithWindows: event.target.checked
              }));
            }}
          />
          Start with Windows
        </label>

        <label>
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={(event) => {
              setSettings((current) => ({
                ...current,
                minimizeToTray: event.target.checked
              }));
            }}
          />
          Minimize to tray on close
        </label>

        <button type="button" disabled={saving} onClick={() => void onSave()}>
          {saving ? "Saving..." : "Save runtime settings"}
        </button>
        <p className="status">{status}</p>
      </section>

      <section className="crud-grid">
        <article className="crud-card">
          <h2>Vendors</h2>
          <div className="crud-form">
            <input value={vendorName} onChange={(event) => setVendorName(event.target.value)} placeholder="Vendor name" />
            <button
              type="button"
              onClick={() => {
                if (!vendorName.trim()) return;
                setVendors((current) => [...current, { id: nextId("vendor"), name: vendorName.trim() }]);
                setVendorName("");
              }}
            >
              Add vendor
            </button>
          </div>
          <ul>
            {vendors.map((vendor) => (
              <li key={vendor.id}>
                <span>{vendor.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextName = window.prompt("Edit vendor name", vendor.name);
                    if (!nextName) return;
                    setVendors((current) =>
                      current.map((entry) => (entry.id === vendor.id ? { ...entry, name: nextName.trim() } : entry))
                    );
                  }}
                >
                  Edit
                </button>
                <button type="button" onClick={() => setVendors((current) => current.filter((entry) => entry.id !== vendor.id))}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Services</h2>
          <div className="crud-form">
            <input value={serviceName} onChange={(event) => setServiceName(event.target.value)} placeholder="Service name" />
            <button
              type="button"
              onClick={() => {
                if (!serviceName.trim()) return;
                const vendorId = vendors[0]?.id ?? "vendor-unassigned";
                setServices((current) => [...current, { id: nextId("service"), vendorId, name: serviceName.trim() }]);
                setServiceName("");
              }}
            >
              Add service
            </button>
          </div>
          <ul>
            {services.map((service) => (
              <li key={service.id}>
                <span>{service.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextName = window.prompt("Edit service name", service.name);
                    if (!nextName) return;
                    setServices((current) =>
                      current.map((entry) => (entry.id === service.id ? { ...entry, name: nextName.trim() } : entry))
                    );
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setServices((current) => current.filter((entry) => entry.id !== service.id))}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Contracts</h2>
          <div className="crud-form">
            <input
              value={contractNumber}
              onChange={(event) => setContractNumber(event.target.value)}
              placeholder="Contract number"
            />
            <button
              type="button"
              onClick={() => {
                if (!contractNumber.trim()) return;
                const serviceId = services[0]?.id ?? "service-unassigned";
                setContracts((current) => [
                  ...current,
                  { id: nextId("contract"), serviceId, contractNumber: contractNumber.trim() }
                ]);
                setContractNumber("");
              }}
            >
              Add contract
            </button>
          </div>
          <ul>
            {contracts.map((contract) => (
              <li key={contract.id}>
                <span>{contract.contractNumber}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextNumber = window.prompt("Edit contract number", contract.contractNumber);
                    if (!nextNumber) return;
                    setContracts((current) =>
                      current.map((entry) =>
                        entry.id === contract.id ? { ...entry, contractNumber: nextNumber.trim() } : entry
                      )
                    );
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setContracts((current) => current.filter((entry) => entry.id !== contract.id))}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Expenses</h2>
          <div className="crud-form">
            <input value={expenseName} onChange={(event) => setExpenseName(event.target.value)} placeholder="Expense name" />
            <input
              value={expenseAmountMinor}
              onChange={(event) => setExpenseAmountMinor(event.target.value)}
              placeholder="Amount minor units"
            />
            <button
              type="button"
              onClick={() => {
                const amountMinor = Number.parseInt(expenseAmountMinor, 10);
                if (!expenseName.trim() || Number.isNaN(amountMinor)) return;
                setExpenses((current) => [
                  ...current,
                  { id: nextId("expense"), name: expenseName.trim(), amountMinor, status: "planned" }
                ]);
                setExpenseName("");
                setExpenseAmountMinor("0");
              }}
            >
              Add expense
            </button>
          </div>
          <ul>
            {expenses.map((expense) => (
              <li key={expense.id}>
                <span>
                  {expense.name} (${(expense.amountMinor / 100).toFixed(2)}) [{expense.status}]
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setExpenses((current) =>
                      current.map((entry) =>
                        entry.id === expense.id
                          ? { ...entry, status: entry.status === "planned" ? "approved" : "planned" }
                          : entry
                      )
                    );
                  }}
                >
                  Edit
                </button>
                <button type="button" onClick={() => setExpenses((current) => current.filter((entry) => entry.id !== expense.id))}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Recurrence Rules</h2>
          <div className="crud-form">
            <input value={recurrenceDay} onChange={(event) => setRecurrenceDay(event.target.value)} placeholder="Day of month" />
            <button
              type="button"
              onClick={() => {
                const expenseId = expenses[0]?.id;
                const dayOfMonth = Number.parseInt(recurrenceDay, 10);
                if (!expenseId || Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return;
                setRecurrences((current) => [
                  ...current,
                  { id: nextId("recurrence"), expenseId, frequency: "monthly", dayOfMonth }
                ]);
              }}
            >
              Add recurrence
            </button>
          </div>
          <ul>
            {recurrences.map((recurrence) => (
              <li key={recurrence.id}>
                <span>{recurrence.frequency} on day {recurrence.dayOfMonth}</span>
                <button
                  type="button"
                  onClick={() => {
                    const nextDay = window.prompt("Edit day of month", String(recurrence.dayOfMonth));
                    const parsed = Number.parseInt(nextDay ?? "", 10);
                    if (Number.isNaN(parsed) || parsed < 1 || parsed > 31) return;
                    setRecurrences((current) =>
                      current.map((entry) =>
                        entry.id === recurrence.id ? { ...entry, dayOfMonth: parsed } : entry
                      )
                    );
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setRecurrences((current) => current.filter((entry) => entry.id !== recurrence.id))}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="crud-card">
          <h2>Dimensions & Tags</h2>
          <div className="crud-form">
            <input
              value={dimensionName}
              onChange={(event) => setDimensionName(event.target.value)}
              placeholder="Dimension name"
            />
            <select value={dimensionMode} onChange={(event) => setDimensionMode(event.target.value as "single_select" | "multi_select")}>
              <option value="single_select">single_select</option>
              <option value="multi_select">multi_select</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={dimensionRequired}
                onChange={(event) => setDimensionRequired(event.target.checked)}
              />
              Required
            </label>
            <button
              type="button"
              onClick={() => {
                if (!dimensionName.trim()) return;
                setDimensions((current) => [
                  ...current,
                  {
                    id: nextId("dimension"),
                    name: dimensionName.trim(),
                    mode: dimensionMode,
                    required: dimensionRequired
                  }
                ]);
                setDimensionName("");
                setDimensionRequired(false);
              }}
            >
              Add dimension
            </button>
          </div>

          <div className="crud-form">
            <input value={tagName} onChange={(event) => setTagName(event.target.value)} placeholder="Tag name" />
            <button
              type="button"
              onClick={() => {
                const dimensionId = dimensions[0]?.id;
                if (!dimensionId || !tagName.trim()) return;
                setTags((current) => [...current, { id: nextId("tag"), dimensionId, name: tagName.trim() }]);
                setTagName("");
              }}
            >
              Add tag
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const expenseId = expenses[0]?.id;
              const tag = tags[0];
              if (!expenseId || !tag) return;

              const dimension = dimensions.find((entry) => entry.id === tag.dimensionId);
              if (!dimension) return;

              setAssignments((current) => {
                const sameDimensionAssignments = current.filter(
                  (entry) =>
                    entry.entityType === "expense_line" &&
                    entry.entityId === expenseId &&
                    entry.dimensionId === tag.dimensionId
                );

                if (dimension.mode === "single_select" && sameDimensionAssignments.length > 0) {
                  return current;
                }

                const exists = current.some(
                  (entry) =>
                    entry.entityType === "expense_line" &&
                    entry.entityId === expenseId &&
                    entry.tagId === tag.id
                );

                if (exists) {
                  return current;
                }

                return [
                  ...current,
                  {
                    entityType: "expense_line",
                    entityId: expenseId,
                    dimensionId: tag.dimensionId,
                    tagId: tag.id
                  }
                ];
              });
            }}
          >
            Assign first tag to first expense
          </button>

          <select value={selectedFilterTagId} onChange={(event) => setSelectedFilterTagId(event.target.value)}>
            <option value="">No filter</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>

          <ul>
            {expenses
              .filter((expense) => filteredExpenseIds.includes(expense.id))
              .map((expense) => (
                <li key={expense.id}>
                  <span>{expense.name}</span>
                </li>
              ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
