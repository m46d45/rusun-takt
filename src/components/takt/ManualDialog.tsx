import { useEffect } from "react";
import { CURING_DAYS, DAYS_PER_WEEK, ZONE_LABELS } from "@/lib/takt/constants";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function ManualDialog({
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
      aria-labelledby="manual-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
          <h2
            id="manual-title"
            className="font-display text-xl text-fg sm:text-2xl"
          >
            Manual Rusun Takt
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

        <div className="space-y-5 overflow-y-auto px-4 py-4 text-sm text-muted sm:px-5">
          <section>
            <h3 className="font-semibold text-fg">Apa ini?</h3>
            <p className="mt-1 leading-relaxed">
              Simulasi pendidikan lean construction untuk rusun 3 lantai. Anda
              melihat dampak <strong className="text-fg">push</strong> (kirim
              tim lebih awal), <strong className="text-fg">JIT</strong>{" "}
              (Just-in-Time), variasi kapasitas, waste menunggu, penalti owner,
              dan margin — seperti permainan Takt Towers, disesuaikan konteks
              Indonesia.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-fg">Bangunan & zonasi</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
              <li>3 lantai walk-up (tangga, tanpa lift).</li>
              <li>
                Per lantai 5 zona:{" "}
                <strong className="text-fg">{ZONE_LABELS.join(" · ")}</strong>{" "}
                (tangga di tengah).
              </li>
              <li>Fondasi & sloof dianggap sudah ada.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-fg">Tujuh tim (wagon)</h3>
            <ol className="mt-1 list-decimal space-y-1 pl-5 leading-relaxed">
              <li>Struktur — kolom & balok</li>
              <li>Pelat & tangga</li>
              <li>Dinding & pasangan</li>
              <li>MEP</li>
              <li>Plester & acian</li>
              <li>Keramik & plafon</li>
              <li>Pengecatan</li>
            </ol>
            <p className="mt-2 leading-relaxed">
              Parade of trades: urutan tetap.{" "}
              <strong className="text-fg">Satu zona = satu tim</strong>. Tim
              berikutnya baru masuk setelah wagon depan meninggalkan zona
              (paling cepat hari berikutnya).
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-fg">
              Curing ({CURING_DAYS} hari)
            </h3>
            <p className="mt-1 leading-relaxed">
              Setelah pelat selesai di suatu zona, zona itu di-curing{" "}
              {CURING_DAYS} hari penuh. Tim dinding (dan setelahnya) baru boleh
              masuk setelah curing. Struktur ke lantai atas menunggu curing zona
              di bawahnya (slot sama). Di takt plan, minggu curing biasanya{" "}
              <strong className="text-fg">putih (kosong)</strong>.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-fg">Setup</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
              <li>
                <strong className="text-fg">Start Kerja</strong> — Minggu 1–7
                (push: sudah dibayar meski menunggu) atau{" "}
                <strong className="text-fg">JIT</strong> (baru mulai &
                dibayar saat zona siap).
              </li>
              <li>
                <strong className="text-fg">Variasi kapasitas</strong> — batas
                bawah–atas hari per zona (contoh 1–9 acak, 7–7 konstan 7 hari).
              </li>
              <li>
                <strong className="text-fg">Biaya / hari</strong> — default 350
                (× Rp1.000 = Rp350.000).
              </li>
              <li>
                <strong className="text-fg">Durasi proyek rusun</strong> default
                120 hari (target selesai);{" "}
                <strong className="text-fg">kontrak</strong> = porsi tenaga
                kerja default 210 juta (bukan total bangunan).
              </li>
              <li>
                <strong className="text-fg">Material & alat</strong> dari
                kontraktor utama — selalu tersedia,{" "}
                <strong className="text-fg">tidak menjadi kendala</strong>,
                tidak dihitung di simulasi.
              </li>
              <li>
                Penalti = hari terlambat × (1/1000) × kontrak tenaga. Margin =
                kontrak tenaga − biaya tenaga − penalti.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-fg">Waktu</h3>
            <p className="mt-1 leading-relaxed">
              Simulasi per <strong className="text-fg">hari</strong>. Takt plan
              diagregasi per minggu:{" "}
              <strong className="text-fg">
                1 minggu = {DAYS_PER_WEEK} hari
              </strong>{" "}
              (kolom 1 = hari 1–7, kolom 2 = hari 8–14, …).
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-fg">Membaca hasil</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
              <li>
                <strong className="text-fg">Warna solid</strong> — tim bekerja
                di zona itu minggu itu.
              </li>
              <li>
                <strong className="text-fg">× pudar</strong> — menunggu (waste).
              </li>
              <li>
                <strong className="text-fg">Putih</strong> — kosong / curing.
              </li>
              <li>
                Maks / min / rata-rata = durasi hari per zona dari roll kapasitas.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-fg">Suara</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 leading-relaxed">
              <li>Zona selesai (cek hijau) — mesin “Ting”</li>
              <li>Satu tim selesai semua zona — “Yessss!”</li>
              <li>Proyek selesai — tepuk tangan</li>
            </ul>
          </section>
        </div>

        <div className="border-t border-border px-4 py-3 sm:px-5">
          <Button type="button" className="w-full sm:w-auto" onClick={onClose}>
            Tutup manual
          </Button>
        </div>
      </div>
    </div>
  );
}
