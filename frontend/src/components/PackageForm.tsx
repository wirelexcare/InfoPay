import { useState, type FormEvent } from "react";
import { ImageUpload } from "./ImageUpload";

export interface PackageFormValues {
  title: string;
  description: string;
  location: string;
  targetAmountGhs: string;
  minInvestmentGhs: string;
  maxInvestmentGhs: string;
  expectedReturnPct: string;
  durationMonths: string;
  imageUrl: string;
}

const emptyValues: PackageFormValues = {
  title: "",
  description: "",
  location: "",
  targetAmountGhs: "",
  minInvestmentGhs: "",
  maxInvestmentGhs: "",
  expectedReturnPct: "",
  durationMonths: "",
  imageUrl: "",
};

interface PackageFormProps {
  initialValues?: Partial<PackageFormValues>;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (values: PackageFormValues) => void;
  onCancel?: () => void;
}

export function PackageForm({
  initialValues,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: PackageFormProps) {
  const [form, setForm] = useState<PackageFormValues>({
    ...emptyValues,
    ...initialValues,
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-lg border border-border bg-card p-6 md:grid-cols-2"
    >
      <div className="md:col-span-2">
        <label className="text-sm font-medium text-ink-700">Image</label>
        <div className="mt-1">
          <ImageUpload
            value={form.imageUrl || null}
            onChange={(url) => setForm({ ...form, imageUrl: url || "" })}
          />
        </div>
      </div>

      <div className="md:col-span-2">
        <label className="text-sm font-medium text-ink-700">Title</label>
        <input
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      <div className="md:col-span-2">
        <label className="text-sm font-medium text-ink-700">Description</label>
        <textarea
          required
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-ink-700">Location</label>
        <input
          required
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-ink-700">
          Target Amount (GHS)
        </label>
        <input
          required
          type="number"
          step="0.01"
          value={form.targetAmountGhs}
          onChange={(e) => setForm({ ...form, targetAmountGhs: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-ink-700">
          Min Investment (GHS)
        </label>
        <input
          required
          type="number"
          step="0.01"
          value={form.minInvestmentGhs}
          onChange={(e) =>
            setForm({ ...form, minInvestmentGhs: e.target.value })
          }
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-ink-700">
          Max Investment (GHS)
        </label>
        <input
          type="number"
          step="0.01"
          placeholder="No limit"
          value={form.maxInvestmentGhs}
          onChange={(e) =>
            setForm({ ...form, maxInvestmentGhs: e.target.value })
          }
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-ink-700">
          Expected Return (%)
        </label>
        <input
          required
          type="number"
          step="0.01"
          value={form.expectedReturnPct}
          onChange={(e) =>
            setForm({ ...form, expectedReturnPct: e.target.value })
          }
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-ink-700">
          Duration (months)
        </label>
        <input
          required
          type="number"
          value={form.durationMonths}
          onChange={(e) => setForm({ ...form, durationMonths: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      <div className="md:col-span-2 flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-6 py-2.5 font-semibold hover:bg-ink-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
