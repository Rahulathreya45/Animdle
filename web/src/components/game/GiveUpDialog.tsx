"use client";

import { useEffect, useId, useRef, useState } from "react";
import buttons from "../buttons.module.css";
import styles from "./GiveUpDialog.module.css";

type Props = {
  disabled?: boolean;
  /** resolves true when the answer was revealed */
  onConfirm: () => Promise<boolean>;
};

// "Give up" button plus a plain confirm dialog (native <dialog>, centred).
export function GiveUpDialog({ disabled, onConfirm }: Props) {
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!open || !d) return;
    if (!d.open) d.showModal();
    keepRef.current?.focus();
  }, [open]);

  function onClose() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function confirm() {
    setBusy(true);
    setFailed(false);
    const ok = await onConfirm();
    setBusy(false);
    if (!ok) setFailed(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`${buttons.secondary} ${styles.trigger}`}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => {
          setFailed(false);
          setOpen(true);
        }}
      >
        Give up
      </button>
      {open && (
        <dialog
          ref={dialogRef}
          className={styles.dialog}
          aria-labelledby={titleId}
          onClose={onClose}
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) e.currentTarget.close();
          }}
        >
          <div className={styles.body}>
            <h2 id={titleId} className={styles.title}>Give up this round?</h2>
            <p className={styles.text}>The answer will be shown and this round will end.</p>
            {failed && <p className={styles.error} role="alert">Could not reveal the answer. Try again.</p>}
            <div className={styles.actions}>
              <button ref={keepRef} type="button" className={buttons.secondary} disabled={busy} onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <button type="button" className={buttons.primary} disabled={busy} onClick={confirm}>
                {busy ? "Giving up..." : "Give up"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
