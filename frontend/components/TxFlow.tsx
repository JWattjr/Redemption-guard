"use client";

import { useEffect, useRef, useState } from "react";
import { GenLayerTransactionPanel, type TrackedStatus } from "@genlayer/transaction-kit-react";
import type { TransactionKit } from "@genlayer/transaction-kit";
import { CONTRACT_ADDRESS } from "@/lib/config";

export type TxRequest = {
  kind: "assess" | "exposure";
  title: string;
  method: "assess_asset" | "request_exposure";
  args: (string | bigint)[];
};

/**
 * Modal around the official Transaction Kit panel: fee review, wallet
 * signature, and lifecycle tracking until the transaction is decided.
 */
export function TxFlow({
  kit,
  request,
  onClose,
  onDone,
}: {
  kit: TransactionKit;
  request: TxRequest;
  onClose: () => void;
  onDone: (status: TrackedStatus) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [darkTheme, setDarkTheme] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    requestAnimationFrame(() => {
      dialog?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus();
    });
    const onCancel = (e: Event) => {
      e.preventDefault();
      dialog?.close();
      onClose();
      requestAnimationFrame(() => previousFocusRef.current?.focus());
    };
    dialog?.addEventListener("cancel", onCancel);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => setDarkTheme(media.matches);
    updateTheme();
    media.addEventListener("change", updateTheme);
    return () => {
      dialog?.removeEventListener("cancel", onCancel);
      media.removeEventListener("change", updateTheme);
    };
  }, [onClose]);

  const close = () => {
    dialogRef.current?.close();
    onClose();
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  };

  return (
    <dialog ref={dialogRef} className="txdialog" aria-modal="true" aria-labelledby="txdialog-title">
      <div className="txdialog__head">
        <h2 id="txdialog-title">{request.title}</h2>
        <button type="button" className="btn btn--ghost" onClick={close}>
          Close
        </button>
      </div>
      <GenLayerTransactionPanel
        kit={kit}
        tx={{ kind: "write", address: CONTRACT_ADDRESS, method: request.method, args: request.args }}
        network="Studio Next · 61997"
        theme={darkTheme ? "dark" : "light"}
        trackUntil="decided"
        onDone={onDone}
      />
    </dialog>
  );
}
