# Rusun Takt

Simulasi pendidikan **lean construction** untuk rusun 3 lantai — terinspirasi [Takt Towers](https://theleanbuilder.com/takt-towers-why-pushing-doesnt-work/).

## Apa yang dipelajari

- **Parade of trades** (barisan wagon) — 7 tim kerja berurutan
- **Push vs JIT** — kapan tim mulai (minggu tetap vs just-in-time)
- **Variasi kapasitas** — hari per zona (bawah–atas)
- **Satu zona, satu tim** — menunggu = waste (tetap dibayar)
- **Curing beton 7 hari** per zona setelah pelat
- **Kontrak, penalti, margin** vs durasi owner

## Bangunan

- 3 lantai walk-up (tangga di tengah, tanpa lift)
- 5 zona per lantai: U1 · U2 · Tangga · U3 · U4
- Fondasi & sloof dianggap sudah ada

## Tujuh tim (wagon)

1. Struktur (kolom & balok)
2. Pelat & tangga
3. Dinding & pasangan
4. MEP
5. Plester & acian
6. Keramik & plafon
7. Pengecatan

## Menjalankan

```bash
npm install
npm run dev
```

Buka `http://localhost:8080`.

```bash
npm run typecheck
npm run build
```

## Stack

React 19 · TypeScript · Vite · TanStack Start · Tailwind CSS

## Lisensi

Proyek edukasi — silakan dipakai dan dimodifikasi untuk pembelajaran.
