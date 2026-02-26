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
    </main>
  );
}
