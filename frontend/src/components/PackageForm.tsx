import { useState, type FormEvent } from "react";

export interface PackageFormValues {
  title: string;
  minInvestmentGhs: string;
  expectedReturnPct: string;
  durationDays: string;
}

const emptyValues: PackageFormValues = {
  title: "",
  minInvestmentGhs: "",
  expectedReturnPct: "",
  durationDays: "",
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

  const days = Number(form.durationDays);
  const dailyRoi = days > 0
    ? ((Number(form.minInvestmentGhs) * Number(form.expectedReturnPct)) / 100 / days).toFixed(2)
    : "0.00";

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 rounded-lg border border-border bg-card p-6 md:grid-cols-2"
    >
      {/* Package Name */}
      <div className="md:col-span-2">
        <label className="text-sm font-medium text-ink-700">Package Name</label>
        <input
          required
          placeholder="e.g., Gold"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      {/* Amount */}
      <div>
        <label className="text-sm font-medium text-ink-700">
          Package Amount (GHS)
        </label>
        <input
          required
          type="number"
          step="0.01"
          placeholder="e.g., 5000"
          value={form.minInvestmentGhs}
          onChange={(e) =>
            setForm({ ...form, minInvestmentGhs: e.target.value })
          }
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      {/* Period in Days */}
      <div>
        <label className="text-sm font-medium text-ink-700">
          Period (Days)
        </label>
        <input
          required
          type="number"
          step="1"
          placeholder="e.g., 90"
          value={form.durationDays}
          onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      {/* ROI % */}
      <div>
        <label className="text-sm font-medium text-ink-700">
          ROI (%)
        </label>
        <input
          required
          type="number"
          step="0.01"
          placeholder="e.g., 12.5"
          value={form.expectedReturnPct}
          onChange={(e) =>
            setForm({ ...form, expectedReturnPct: e.target.value })
          }
          className="mt-1 w-full rounded-lg border border-border px-3 py-2"
        />
      </div>

      {/* Auto-calculated Daily ROI */}
      <div className="md:col-span-2 p-3 rounded-lg bg-primary/10">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-ink-500">Total Return (GHS)</p>
            <p className="text-lg font-bold text-primary">
              ₵{((Number(form.minInvestmentGhs) || 0) * (Number(form.expectedReturnPct) || 0) / 100).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Period (Days)</p>
            <p className="text-lg font-bold text-primary">{days || 0}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500">Daily ROI (GHS)</p>
            <p className="text-lg font-bold text-primary">₵{dailyRoi}</p>
          </div>
        </div>
      </div>

      {/* Submit & Cancel */}
      <div className="md:col-span-2 flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 font-medium text-white disabled:opacity-50 hover:bg-primary/90 transition"
        >
          {submitting ? "Creating..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border px-4 py-2.5 font-medium text-ink-600 hover:bg-ink-50 transition"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
