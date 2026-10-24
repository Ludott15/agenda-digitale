import { Minus, Plus } from "lucide-react";
import { cn } from "@/components/ui/cn";

export interface CountStepperProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  hint?: string;
  error?: string;
}

const STEP_BUTTON =
  "flex size-12 shrink-0 items-center justify-center rounded-btn border border-petrol text-petrol transition-colors duration-200 hover:bg-petrol hover:text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petrol disabled:cursor-not-allowed disabled:border-disabled disabled:text-disabled disabled:hover:bg-transparent disabled:hover:text-disabled";

/** Stepper +/- grande per i conteggi (coperti). Il valore è sempre clampato tra min e max. */
export function CountStepper({ id, label, value, onChange, min = 0, max, hint, error }: CountStepperProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const clamp = (n: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, n));
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[12px] font-medium uppercase tracking-[0.14em] text-slate-dark">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Diminuisci ${label.toLowerCase()}`}
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= min}
          className={STEP_BUTTON}
        >
          <Minus aria-hidden="true" className="size-5" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            const n = Math.floor(Number(e.target.value));
            onChange(clamp(Number.isFinite(n) ? n : min));
          }}
          className={cn(
            "h-12 w-full min-w-0 rounded-btn border bg-paper text-center font-serif text-2xl tabular-nums text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-petrol/40",
            error ? "border-danger" : "border-slate/70",
          )}
        />
        <button
          type="button"
          aria-label={`Aumenta ${label.toLowerCase()}`}
          onClick={() => onChange(clamp(value + 1))}
          disabled={max !== undefined && value >= max}
          className={STEP_BUTTON}
        >
          <Plus aria-hidden="true" className="size-5" />
        </button>
      </div>
      {error ? (
        <p id={errorId} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-slate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
