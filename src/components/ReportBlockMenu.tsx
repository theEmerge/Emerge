"use client";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/reports";

type Target = { type: "POST" | "COMMENT" | "MESSAGE" | "USER"; id: string };

// A "..." button that opens a small sheet: Report this / Block @user.
// Used on posts, comments, profiles and DM messages. `onBlocked` lets the
// page drop the blocked person's content right away.
export default function ReportBlockMenu({
  target,
  userId,
  handle,
  onBlocked,
  size = 16,
  label = "More options",
}: {
  target: Target;
  userId: string; // the author of the thing being reported (who "Block" applies to)
  handle: string;
  onBlocked?: (userId: string) => void;
  size?: number;
  label?: string;
}) {
  const [step, setStep] = useState<"closed" | "menu" | "reason" | "done" | "confirmBlock" | "blocked">("closed");
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setStep("closed"); setReason(""); setNote(""); setError("");
  }

  async function submitReport() {
    if (!reason) return;
    setBusy(true); setError("");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: target.type, targetId: target.id, reason, note }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) setStep("done");
    else if (res?.status === 429) setError("You're reporting too fast. Try again in a minute.");
    else setError("Couldn't send the report. Try again.");
  }

  async function block() {
    setBusy(true); setError("");
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError("Couldn't block. Try again."); return; }
    setStep("blocked");
  }

  function finishBlocked() {
    close();
    if (onBlocked) onBlocked(userId);
    else window.location.reload();
  }

  return (
    <>
      <button className="ap-safety-menu-btn" onClick={() => setStep("menu")} aria-label={label} title={label}>
        <MoreHorizontal size={size} />
      </button>
      {step !== "closed" && (
        <div className="ap-safety-backdrop" onClick={step === "blocked" ? finishBlocked : close}>
          <div className="ap-safety-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            {step === "menu" && (
              <>
                <h3>@{handle}</h3>
                <button className="ap-safety-item danger" onClick={() => setStep("reason")}>Report…</button>
                <button className="ap-safety-item danger" onClick={() => setStep("confirmBlock")}>Block @{handle}</button>
                <button className="ap-safety-item" onClick={close}>Cancel</button>
              </>
            )}
            {step === "reason" && (
              <>
                <h3>Why are you reporting this?</h3>
                {REPORT_REASONS.map((r) => (
                  <label key={r} className="ap-safety-item" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
                    {REPORT_REASON_LABELS[r]}
                  </label>
                ))}
                <textarea placeholder="Anything else we should know? (optional)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
                {error && <div className="ap-auth-error">{error}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="ap-post-btn" onClick={submitReport} disabled={!reason || busy}>{busy ? "Sending…" : "Send report"}</button>
                  <button className="ap-icon-btn" onClick={close}>Cancel</button>
                </div>
              </>
            )}
            {step === "done" && (
              <>
                <h3>Thanks, we got your report</h3>
                <p className="ap-safety-note">Our team reviews reports every day. The person isn't told it was you.</p>
                <button className="ap-safety-item danger" onClick={() => setStep("confirmBlock")}>Also block @{handle}</button>
                <button className="ap-safety-item" onClick={close}>Done</button>
              </>
            )}
            {step === "confirmBlock" && (
              <>
                <h3>Block @{handle}?</h3>
                <p className="ap-safety-note">You won't see each other's posts, comments or profiles, and neither of you can message or follow the other. You can unblock them any time in Settings.</p>
                {error && <div className="ap-auth-error">{error}</div>}
                <button className="ap-safety-item danger" onClick={block} disabled={busy}>{busy ? "Blocking…" : "Block"}</button>
                <button className="ap-safety-item" onClick={close}>Cancel</button>
              </>
            )}
            {step === "blocked" && (
              <>
                <h3>Blocked @{handle}</h3>
                <p className="ap-safety-note">You won't see each other any more.</p>
                <button className="ap-safety-item" onClick={finishBlocked}>OK</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
