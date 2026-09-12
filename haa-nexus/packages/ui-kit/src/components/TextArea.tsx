import type { TextareaHTMLAttributes } from "react";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  id: string;
}

export function TextArea({ label, id, className, ...rest }: TextAreaProps) {
  return (
    <div className="nexus-field">
      <label htmlFor={id} className="nexus-field__label">
        {label}
      </label>
      <textarea id={id} className={["nexus-textarea", className].filter(Boolean).join(" ")} {...rest} />
    </div>
  );
}
