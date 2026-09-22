# Rusun Takt

Simulasi pendidikan **lean construction** untuk rusun 3 lantai — terinspirasi [Takt Towers](https://theleanbuilder.com/takt-towers-why-pushing-doesnt-work/).

**Peserta hanya butuh browser.** Buka URL aplikasi web, tanpa akun dan tanpa instal. Simulasi berjalan di perangkat masing-masing (cocok untuk banyak orang / kelas).

Aplikasi publik: [rusun-takt.vercel.app](https://rusun-takt.vercel.app)

## Untuk peserta

1. Buka URL di atas.
2. Mode **Workshop** → pilih skenario **A / B / C**, lalu **Start skenario**.
3. Atau pilih **D** / tombol **Bandingkan Push vs JIT** untuk debrief cepat.
4. Baca **Istilah** jika ada kata asing; **Unduh ringkasan** setelah selesai.

Panduan kelas: [`docs/PELATIHAN.md`](docs/PELATIHAN.md)

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

## Untuk fasilitator

- Set **seed sama** (default 42) agar hasil kelompok bisa dibandingkan.
- Ikuti agenda 60/90 menit di [`docs/PELATIHAN.md`](docs/PELATIHAN.md).
- Mode **Lanjutan** hanya jika peserta sudah paham skenario Workshop.

## Untuk pengembang (opsional)

Menjalankan UI React di mesin sendiri:

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run build
```

Stack: React 19 · TypeScript · Vite · TanStack Start · Tailwind CSS

### Streamlit (opsional / legacy)

Ada aplikasi Python terpisah untuk eksperimen di Streamlit Community Cloud. **Jalur utama pelatihan publik adalah aplikasi web React di atas** — bukan Streamlit.

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

## Lisensi

[MIT](LICENSE) — silakan dipakai dan dimodifikasi untuk pembelajaran.
