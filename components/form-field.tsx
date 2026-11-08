import { CircleAlert } from "lucide-react";
import type { UseFormRegister, FieldErrors } from "react-hook-form";
import { todayInJakarta, type SubmissionValues } from "@/lib/validation";
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
  suggestions,
}: {
  name: keyof SubmissionValues;
  label: string;
  register: UseFormRegister<SubmissionValues>;
  errors: FieldErrors<SubmissionValues>;
  type?: string;
  wide?: boolean;
  options?: readonly string[];
  suggestions?: readonly string[];
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
        <textarea {...props} placeholder={placeholder} maxLength={name === "isi_keterangan" ? 500 : 200} />
      ) : (
        <input
          {...props}
          type={type}
          placeholder={placeholder}
          list={suggestions ? `${name}-suggestions` : undefined}
          maxLength={name === "nik" || name === "no_kk" ? 16 : name === "pekerjaan" ? 60 : ["acara", "tempat_acara", "jenis_hiburan"].includes(name) ? 120 : 200}
          inputMode={
            ["nik", "no_kk", "rt", "rw"].includes(name) ? "numeric" : undefined
          }
          min={name === "tanggal_lahir" ? "1900-01-01" : undefined}
          max={name === "tanggal_lahir" ? todayInJakarta() : undefined}
        />
      )}{" "}
      {suggestions && <datalist id={`${name}-suggestions`}>{suggestions.map((value) => <option key={value} value={value} />)}</datalist>}
      {hint && <p id={`${name}-hint`} className="mt-2">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="field-error">
          <CircleAlert size={22} aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
