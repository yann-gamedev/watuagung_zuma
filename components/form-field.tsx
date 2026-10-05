import type { UseFormRegister, FieldErrors } from "react-hook-form";
import type { SubmissionValues } from "@/lib/validation";
export function FormField({
  name,
  label,
  register,
  errors,
  type = "text",
  wide = false,
  options,
  placeholder,
  onValueChange,
  hint,
}: {
  name: keyof SubmissionValues;
  label: string;
  register: UseFormRegister<SubmissionValues>;
  errors: FieldErrors<SubmissionValues>;
  type?: string;
  wide?: boolean;
  options?: string[];
  placeholder?: string;
  onValueChange?: (value: string) => void;
  hint?: string;
}) {
  const error = errors[name]?.message;
  const props = {
    id: name,
    required: true,
    "aria-invalid": !!error,
    "aria-describedby": [hint ? `${name}-hint` : "", error ? `${name}-error` : ""].filter(Boolean).join(" ") || undefined,
    ...register(name, { onChange: (event) => onValueChange?.(event.target.value) }),
  };
  return (
    <div className={"field" + (wide ? " wide" : "")}>
      <label htmlFor={name}>
        {label} <span aria-hidden="true">*</span>
      </label>
      {options ? (
        <select {...props}>
          <option value="">Pilih {label.toLowerCase()}</option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : type === "textarea" ? (
        <textarea {...props} placeholder={placeholder} />
      ) : (
        <input
          {...props}
          type={type}
          placeholder={placeholder}
          maxLength={name === "nik" || name === "no_kk" ? 16 : 200}
          inputMode={
            ["nik", "no_kk", "rt", "rw"].includes(name) ? "numeric" : undefined
          }
          max={
            type === "date" ? new Date().toISOString().slice(0, 10) : undefined
          }
        />
      )}{" "}
      {hint && <p id={`${name}-hint`} className="text-sm mt-2">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
