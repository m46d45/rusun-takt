import { useEffect } from "react";
import { GLOSSARY } from "@/lib/takt/workshop";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function GlossaryDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="glossary-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="glossary-title"
            className="font-display text-xl text-fg sm:text-2xl"
          >
            Istilah singkat
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {GLOSSARY.map((g) => (
            <div key={g.term}>
              <h3 className="font-semibold text-fg">{g.term}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {g.meaning}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-border px-4 py-3 sm:px-5">
          <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
