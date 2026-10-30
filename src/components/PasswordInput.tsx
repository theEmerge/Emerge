"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Plain password <input> plus a show/hide toggle - used on login and
// register instead of a bare type="password" field. Props pass straight
// through the same way the original inputs were used (value/onChange/etc.)
export default function PasswordInput({
  value,
  onChange,
  placeholder = "Password",
  required,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="ap-password-field">
      <input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete="current-password"
      />
      <button
        type="button"
        className="ap-password-toggle"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
