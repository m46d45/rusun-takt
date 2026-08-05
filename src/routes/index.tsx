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
      <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
        <div className="text-center">
          <p className="font-display text-2xl text-fg">Rusun Takt</p>
          <p className="mt-2 text-sm text-muted">Memuat…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 space-y-2">
          <h1 className="font-display text-3xl text-fg sm:text-4xl">
            Rusun Takt
          </h1>
          <p className="max-w-2xl text-sm text-muted sm:text-base">
            Simulasi parade tim kerja dan metodologi Takt. Pembelajaran dampak
            dari metode dorong (push), pengembangan kapasitas (capacity
            building) dan aliran (flow) dengan pendekatan Takt.
          </p>
        </header>
        <Simulator />
      </div>
    </div>
  );
}
