import { useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  Select,
  Text
} from "@fluentui/react-components";

import { InlineError } from "../../ui/primitives";
import type { OwnerOptionRecord, OwnerUsageRecord } from "../../lib/ipcClient";
import "./OwnerDirectory.css";

type OwnerManagerDialogProps = {
  open: boolean;
  owners: OwnerOptionRecord[];
  onOpenChange: (open: boolean) => void;
  onCreateOwner: (name: string) => Promise<OwnerOptionRecord | null> | OwnerOptionRecord | null;
  onGetOwnerUsage: (ownerId: string) => Promise<OwnerUsageRecord> | OwnerUsageRecord;
  onRetireOwner: (ownerId: string, replacementOwnerId?: string | null) => Promise<void> | void;
};

type RetireDraft = {
  ownerId: string;
  replacementOwnerId: string;
  usage: OwnerUsageRecord;
};

function totalUsage(owner: OwnerOptionRecord): number {
  return owner.vendorCount + owner.serviceCount + owner.contractCount;
}

export function OwnerManagerDialog({
  open,
  owners,
  onOpenChange,
  onCreateOwner,
  onGetOwnerUsage,
  onRetireOwner
}: OwnerManagerDialogProps) {
  const [newOwnerName, setNewOwnerName] = useState("");
  const [pendingOwnerId, setPendingOwnerId] = useState<string | null>(null);
  const [retireDraft, setRetireDraft] = useState<RetireDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeOwners = useMemo(
    () => owners.filter((owner) => owner.archivedAt === null),
    [owners]
  );

  async function handleCreateOwner(): Promise<void> {
    const trimmed = newOwnerName.trim();
    if (!trimmed) {
      setError("Owner name is required.");
      return;
    }
    setPendingOwnerId("create");
    setError(null);
    try {
      await onCreateOwner(trimmed);
      setNewOwnerName("");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : String(issue));
    } finally {
      setPendingOwnerId(null);
    }
  }

  async function beginRetire(owner: OwnerOptionRecord): Promise<void> {
    setError(null);
    if (totalUsage(owner) === 0) {
      setPendingOwnerId(owner.id);
      try {
        await onRetireOwner(owner.id);
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : String(issue));
      } finally {
        setPendingOwnerId(null);
      }
      return;
    }

    setPendingOwnerId(owner.id);
    try {
      const usage = await onGetOwnerUsage(owner.id);
      setRetireDraft({
        ownerId: owner.id,
        replacementOwnerId: "",
        usage
      });
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : String(issue));
    } finally {
      setPendingOwnerId(null);
    }
  }

  async function confirmRetire(): Promise<void> {
    if (!retireDraft || !retireDraft.replacementOwnerId) {
      setError("Choose a replacement owner before retiring this owner.");
      return;
    }
    setPendingOwnerId(retireDraft.ownerId);
    setError(null);
    try {
      await onRetireOwner(retireDraft.ownerId, retireDraft.replacementOwnerId);
      setRetireDraft(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : String(issue));
    } finally {
      setPendingOwnerId(null);
    }
  }

  const replacementChoices = retireDraft
    ? activeOwners.filter((owner) => owner.id !== retireDraft.ownerId)
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        if (!data.open) {
          setRetireDraft(null);
          setError(null);
          setNewOwnerName("");
        }
        onOpenChange(data.open);
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Manage owners</DialogTitle>
          <DialogContent>
            <div className="owner-directory">
              <section className="owner-directory__section">
                <Text weight="semibold">Add owner</Text>
                <div className="owner-directory__row">
                  <Input
                    aria-label="New owner name"
                    placeholder="Owner team"
                    value={newOwnerName}
                    onChange={(_event, data) => setNewOwnerName(data.value)}
                  />
                  <Button
                    appearance="primary"
                    onClick={() => {
                      void handleCreateOwner();
                    }}
                    disabled={pendingOwnerId === "create"}
                  >
                    Add owner
                  </Button>
                </div>
              </section>

              <section className="owner-directory__section">
                <Text weight="semibold">Active owners</Text>
                <ul className="owner-directory__list">
                  {activeOwners.map((owner) => (
                    <li key={owner.id} className="owner-directory__item">
                      <div>
                        <Text>{owner.name}</Text>
                        <Text size={200}>{`${owner.vendorCount} vendors, ${owner.serviceCount} services, ${owner.contractCount} contracts`}</Text>
                      </div>
                      <Button
                        appearance="secondary"
                        disabled={pendingOwnerId === owner.id}
                        onClick={() => {
                          void beginRetire(owner);
                        }}
                      >
                        Retire
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>

              {retireDraft ? (
                <section className="owner-directory__section">
                  <Text weight="semibold">{`Remap ${retireDraft.usage.owner.name}`}</Text>
                  <Text size={200}>
                    Choose a replacement owner before retiring this owner.
                  </Text>
                  <div className="owner-directory__field">
                    <Text size={200}>Replacement owner</Text>
                    <Select
                      aria-label="Replacement owner"
                      value={retireDraft.replacementOwnerId}
                      onChange={(event) =>
                        setRetireDraft((current) =>
                          current
                            ? {
                                ...current,
                                replacementOwnerId: event.target.value
                              }
                            : current
                        )
                      }
                    >
                      <option value="">Select owner</option>
                      {replacementChoices.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="owner-directory__usage">
                    <Text size={200}>Vendors</Text>
                    <ul>
                      {retireDraft.usage.vendors.map((vendor) => (
                        <li key={vendor.id}>{vendor.name}</li>
                      ))}
                    </ul>
                    <Text size={200}>Services</Text>
                    <ul>
                      {retireDraft.usage.services.map((service) => (
                        <li key={service.id}>{service.name}</li>
                      ))}
                    </ul>
                    <Text size={200}>Contracts</Text>
                    <ul>
                      {retireDraft.usage.contracts.map((contract) => (
                        <li key={contract.id}>{contract.contractNumber ?? contract.id}</li>
                      ))}
                    </ul>
                  </div>
                </section>
              ) : null}

              {error ? <InlineError message={error} /> : null}
            </div>
          </DialogContent>
          <DialogActions>
            {retireDraft ? (
              <Button appearance="secondary" onClick={() => setRetireDraft(null)}>
                Cancel remap
              </Button>
            ) : null}
            <Button appearance="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {retireDraft ? (
              <Button
                appearance="primary"
                disabled={pendingOwnerId === retireDraft.ownerId}
                onClick={() => {
                  void confirmRetire();
                }}
              >
                Remap and retire
              </Button>
            ) : null}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
