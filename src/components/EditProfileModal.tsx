"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, X } from "lucide-react";
import Avatar from "./Avatar";

export type EditableUser = {
  name: string;
  handle: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
};

const ERRORS: Record<string, string> = {
  handle_taken: "That username is already taken.",
  invalid_handle: "Usernames are 3-30 characters: letters, numbers, _ and . only.",
  invalid_name: "Name must be 1-50 characters.",
  invalid_bio: "Bio can be up to 160 characters.",
};

export default function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: EditableUser;
  onClose: () => void;
  onSaved: (changes: Partial<EditableUser>) => void;
}) {
  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(user.handle);
  const [bio, setBio] = useState(user.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState(user.bannerUrl);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>, kind: "avatar" | "banner") {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      if (!res.ok) {
        setError("Upload failed - try a smaller image.");
        return;
      }
      const { url } = await res.json();
      if (kind === "avatar") setAvatarUrl(url);
      else setBannerUrl(url);
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  }

  async function save() {
    const changes: Partial<EditableUser> = {};
    if (name.trim() !== user.name) changes.name = name.trim();
    if (handle.trim() !== user.handle) changes.handle = handle.trim().replace(/^@/, "");
    if (bio.trim() !== (user.bio || "")) changes.bio = bio.trim();
    if (avatarUrl !== user.avatarUrl) changes.avatarUrl = avatarUrl;
    if (bannerUrl !== user.bannerUrl) changes.bannerUrl = bannerUrl;
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(ERRORS[body.error] || "Couldn't save - try again.");
        return;
      }
      onSaved(changes);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ig-postdetail-overlay" onClick={() => !saving && onClose()}>
      <div className="ig-edit-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ig-edit-head">
          <h2>Edit profile</h2>
          <button className="ig-edit-x" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="ig-edit-banner" onClick={() => bannerRef.current?.click()}>
          {bannerUrl && <Image src={bannerUrl} alt="" fill sizes="480px" style={{ objectFit: "cover" }} />}
          <span className="ig-edit-banner-btn">
            <Camera size={14} /> {uploading === "banner" ? "Uploading…" : "Change banner"}
          </span>
        </div>
        <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e, "banner")} />

        <div className="ig-edit-avatar-row">
          <button className="ig-edit-avatar" onClick={() => avatarRef.current?.click()} aria-label="Change profile photo">
            <Avatar name={name || user.name} src={avatarUrl} size={72} />
            <span className="ig-edit-avatar-cam">
              <Camera size={13} />
            </span>
          </button>
          <span className="ig-edit-hint">{uploading === "avatar" ? "Uploading…" : "Tap to change your photo"}</span>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e, "avatar")} />

        <label className="ig-edit-label">Name</label>
        <input className="ig-edit-input" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} />

        <label className="ig-edit-label">Username</label>
        <div className="ig-edit-handle">
          <span>@</span>
          <input
            value={handle}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setHandle(e.target.value.replace(/[^A-Za-z0-9_.]/g, ""))}
          />
        </div>

        <label className="ig-edit-label">
          Bio <span className="ig-edit-count">{bio.length}/160</span>
        </label>
        <textarea className="ig-edit-input" rows={3} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Write a short bio…" />

        {error && <div className="ig-edit-error">{error}</div>}

        <div className="ig-edit-actions">
          <button className="ig-bio-cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="ap-post-btn" onClick={save} disabled={saving || !!uploading || name.trim().length === 0 || handle.length < 3}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
