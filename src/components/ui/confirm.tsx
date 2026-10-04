"use client";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { Button } from "./button";
export function Confirm({
  label,
  description,
  onConfirm,
  danger = false,
}: {
  label: string;
  description: string;
  onConfirm: () => Promise<void>;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger asChild>
        <Button variant={danger ? "danger" : "secondary"}>{label}</Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title>{label}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="actions">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" disabled={busy}>
                Volver
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={danger ? "danger" : "primary"}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await onConfirm();
                  setOpen(false);
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Ocurrió un error.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Procesando…" : "Confirmar"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
