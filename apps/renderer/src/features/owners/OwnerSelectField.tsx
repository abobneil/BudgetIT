import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Text } from "@fluentui/react-components";

import type { OwnerOptionRecord, OwnerUsageRecord } from "../../lib/ipcClient";
import { normalizeOwnerName } from "./owner-model";
import { OwnerManagerDialog } from "./OwnerManagerDialog";
import "./OwnerDirectory.css";

type OwnerSelectFieldProps = {
  label: string;
  inputAriaLabel: string;
  placeholder: string;
  selectedOwnerId: string;
  owners: OwnerOptionRecord[];
  onSelect: (ownerId: string) => void;
  onCreateOwner: (name: string) => Promise<OwnerOptionRecord | null> | OwnerOptionRecord | null;
  onGetOwnerUsage: (ownerId: string) => Promise<OwnerUsageRecord> | OwnerUsageRecord;
  onRetireOwner: (ownerId: string, replacementOwnerId?: string | null) => Promise<void> | void;
};

export function OwnerSelectField({
  label,
  inputAriaLabel,
  placeholder,
  selectedOwnerId,
  owners,
  onSelect,
  onCreateOwner,
  onGetOwnerUsage,
  onRetireOwner
}: OwnerSelectFieldProps) {
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedOwner = useMemo(
    () => owners.find((owner) => owner.id === selectedOwnerId) ?? null,
    [owners, selectedOwnerId]
  );
  const activeOwners = useMemo(
    () => owners.filter((owner) => owner.archivedAt === null),
    [owners]
  );
  const filteredOwners = useMemo(() => {
    const normalizedQuery = normalizeOwnerName(query);
    return activeOwners.filter((owner) =>
      normalizedQuery.length === 0
        ? true
        : normalizeOwnerName(owner.name).includes(normalizedQuery)
    );
  }, [activeOwners, query]);
  const exactMatch = useMemo(
    () =>
      activeOwners.find((owner) => normalizeOwnerName(owner.name) === normalizeOwnerName(query)) ??
      null,
    [activeOwners, query]
  );

  useEffect(() => {
    setQuery(selectedOwner?.name ?? "");
  }, [selectedOwner?.name]);

  async function handleCreateOwner(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setPending(true);
    try {
      const created = await onCreateOwner(trimmed);
      if (created) {
        onSelect(created.id);
        setQuery(created.name);
      }
      setListOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="owner-select">
      <Text className="owner-select__label" size={200} weight="medium">
        {label}
      </Text>
      <div className="owner-select__row">
        <div className="owner-select__combobox">
          <Input
            aria-label={inputAriaLabel}
            placeholder={placeholder}
            ref={inputRef}
            value={query}
            onFocus={() => setListOpen(true)}
            onBlur={() => {
              window.setTimeout(() => {
                setListOpen(false);
                setQuery((selectedOwner?.name ?? "").trim());
              }, 0);
            }}
            onChange={(_event, data) => {
              setQuery(data.value);
              if (selectedOwner && normalizeOwnerName(selectedOwner.name) !== normalizeOwnerName(data.value)) {
                onSelect("");
              }
              setListOpen(true);
            }}
          />
          {listOpen ? (
            <ul aria-label={`${label} options`} className="owner-select__options" role="listbox">
              {filteredOwners.map((owner) => (
                <li key={owner.id} role="option" aria-selected={owner.id === selectedOwnerId}>
                  <button
                    className={
                      owner.id === selectedOwnerId
                        ? "owner-select__option owner-select__option--active"
                        : "owner-select__option"
                    }
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelect(owner.id);
                      setQuery(owner.name);
                      setListOpen(false);
                    }}
                  >
                    <span>{owner.name}</span>
                    <span className="owner-select__meta">{`${owner.vendorCount}/${owner.serviceCount}/${owner.contractCount}`}</span>
                  </button>
                </li>
              ))}
              {!exactMatch && query.trim().length > 0 ? (
                <li role="option" aria-selected="false">
                  <button
                    className="owner-select__option owner-select__option--add"
                    disabled={pending}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      void handleCreateOwner(query);
                    }}
                  >
                    {`Add "${query.trim()}"`}
                  </button>
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
        <Button appearance="secondary" onClick={() => setManagerOpen(true)} type="button">
          Manage owners
        </Button>
      </div>
      <OwnerManagerDialog
        open={managerOpen}
        owners={owners}
        onOpenChange={setManagerOpen}
        onCreateOwner={async (name) => {
          const created = await onCreateOwner(name);
          if (created) {
            onSelect(created.id);
            setQuery(created.name);
          }
          return created;
        }}
        onGetOwnerUsage={onGetOwnerUsage}
        onRetireOwner={async (ownerId, replacementOwnerId) => {
          await onRetireOwner(ownerId, replacementOwnerId);
          if (selectedOwnerId === ownerId) {
            onSelect(replacementOwnerId ?? "");
            const replacement = owners.find((owner) => owner.id === replacementOwnerId);
            setQuery(replacement?.name ?? "");
          }
        }}
      />
    </div>
  );
}
