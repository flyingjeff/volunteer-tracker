import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      {label}
      <input
        className={`focus-ring min-h-11 rounded-md border border-ink/15 bg-white px-3 text-base font-medium text-ink placeholder:text-ink/35 ${className}`}
        {...props}
      />
    </label>
  );
}

export function TextArea({
  label,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      {label}
      <textarea
        className={`focus-ring min-h-24 resize-y rounded-md border border-ink/15 bg-white px-3 py-2 text-base font-medium text-ink placeholder:text-ink/35 ${className}`}
        {...props}
      />
    </label>
  );
}
