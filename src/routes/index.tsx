import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Simulator } from "@/components/takt/Simulator";

export const Route = createFileRoute("/")({
  component: HomePage,
  ssr: false,
});

function HomePage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="text-center">
          <img
            src="/logo.png"
            alt=""
            className="mx-auto mb-3 h-16 w-16 rounded-2xl border-2 border-sky-300 bg-white shadow-md"
          />
          <p className="font-display text-2xl text-sky-900">Rusun Takt</p>
          <p className="mt-2 text-sm text-muted">Memuat…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 overflow-hidden rounded-2xl border-2 border-sky-300 bg-white/90 p-4 shadow-lg shadow-sky-200/50 sm:p-5">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <img
              src="/logo.png"
              alt="Logo Rusun Takt"
              className="h-20 w-20 shrink-0 rounded-2xl border-2 border-amber-300 bg-sky-50 object-cover shadow-md sm:h-24 sm:w-24"
            />
            <div className="min-w-0 space-y-2">
              <h1 className="font-display text-3xl text-sky-950 sm:text-4xl">
                Rusun Takt
              </h1>
              <p className="max-w-2xl text-sm text-muted sm:text-base">
                Simulasi parade tim kerja dan metodologi Takt. Pembelajaran
                dampak dari metode dorong (push), pengembangan kapasitas
                (capacity building) dan aliran (flow) dengan pendekatan Takt.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-sky-300 bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-900">
                  3 lantai
                </span>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  5 zona / lantai
                </span>
                <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-900">
                  7 wagon
                </span>
              </div>
            </div>
          </div>
        </header>
        <Simulator />
      </div>
    </div>
  );
}
