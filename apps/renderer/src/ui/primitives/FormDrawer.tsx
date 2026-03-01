import type { ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle
} from "@fluentui/react-components";

type FormDrawerProps = {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  children: ReactNode;
  submitLabel?: string;
};

export function FormDrawer({
  open,
  title,
  onOpenChange,
  onSubmit,
  children,
  submitLabel = "Save"
}: FormDrawerProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(_, data) => {
        onOpenChange(data.open);
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem"
              }}
            >
              <span>{title}</span>
            </div>
          </DialogTitle>
          <DialogContent>{children}</DialogContent>
          <DialogActions>
            <Button
              appearance="secondary"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button appearance="primary" onClick={onSubmit}>
              {submitLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
