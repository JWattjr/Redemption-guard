"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog?.addEventListener("cancel", onCancel);
    return () => dialog?.removeEventListener("cancel", onCancel);
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="txdialog" aria-labelledby="txdialog-title">
      <div className="txdialog__head">
        <div>
          <div className="eyebrow">Sign on Studio Next</div>
          <h2 id="txdialog-title">{request.title}</h2>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <GenLayerTransactionPanel
        kit={kit}
        tx={{ kind: "write", address: CONTRACT_ADDRESS, method: request.method, args: request.args }}
        network="Studio Next · 61997"
        theme="light"
        trackUntil="decided"
        onDone={onDone}
      />
    </dialog>
  );
}
