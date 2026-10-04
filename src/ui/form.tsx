"use client";
import { useForm } from "react-hook-form";
import { useId } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
export type Field = {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
  min?: number;
  max?: number;
  placeholder?: string;
};
export function Form({
  fields,
  initial = {},
  onSubmit,
  submit = "Guardar cambios",
  schema,
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submit?: string;
  schema?: z.ZodType;
}) {
  const prefix = useId();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, unknown>>({ defaultValues: initial });
  return (
    <form
      className="handly-form"
      onSubmit={handleSubmit(async (data) => {
        try {
          if (schema) {
            const result = schema.safeParse(data);
            if (!result.success) {
              for (const issue of result.error.issues)
                setError(String(issue.path[0] ?? "root"), {
                  message: issue.message,
                });
              return;
            }
            data = result.data as Record<string, unknown>;
          }
          await onSubmit(data);
        } catch (e) {
          setError("root", {
            message:
              e instanceof Error
                ? e.message
                : "No pudimos guardar los cambios.",
          });
        }
      })}
    >
      {fields.map((field) => (
        <div
          key={field.name}
          className={field.type === "checkbox" ? "field check-field" : "field"}
        >
          <label htmlFor={`${prefix}-${field.name}`}>
            {field.label}
            {field.required !== false && field.type !== "checkbox" ? (
              <span aria-hidden="true"> *</span>
            ) : (
              ""
            )}
          </label>
          {field.options ? (
            <select
              id={`${prefix}-${field.name}`}
              {...register(field.name, {
                required:
                  field.required === false ? false : "Selecciona una opción.",
              })}
              aria-invalid={!!errors[field.name]}
            >
              {field.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              id={`${prefix}-${field.name}`}
              rows={4}
              placeholder={field.placeholder}
              {...register(field.name, {
                required:
                  field.required === false ? false : "Completa este campo.",
              })}
              aria-invalid={!!errors[field.name]}
            />
          ) : (
            <input
              id={`${prefix}-${field.name}`}
              type={field.type ?? "text"}
              min={field.min}
              max={field.max}
              step={field.type === "number" ? "any" : undefined}
              placeholder={field.placeholder}
              {...register(field.name, {
                required:
                  field.required === false ? false : "Completa este campo.",
              })}
              aria-invalid={!!errors[field.name]}
              autoComplete={
                field.name === "password"
                  ? "current-password"
                  : field.name === "email"
                    ? "email"
                    : undefined
              }
            />
          )}
          {field.hint && (
            <small id={`${prefix}-${field.name}-hint`}>{field.hint}</small>
          )}
          {errors[field.name] && (
            <small role="alert" className="error">
              {String(errors[field.name]?.message)}
            </small>
          )}
        </div>
      ))}
      {errors.root && (
        <p role="alert" className="error">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Guardando…" : submit}
      </Button>
    </form>
  );
}
