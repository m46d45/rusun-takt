# -*- coding: utf-8 -*-
"""Rusun Takt — Streamlit, layout selaras sandbox (tanpa sidebar)."""
from __future__ import annotations

import base64
import traceback
from pathlib import Path

import streamlit as st

from rusun_takt_engine import (
    TEAMS,
    ZONE_LABELS,
    TOTAL_UNITS,
    UNITS_PER_FLOOR,
    FLOORS,
    DAYS_PER_WEEK,
    CURING_DAYS,
    START_JIT,
    DEFAULT_OWNER_DURATION,
    DEFAULT_CONTRACT_VALUE,
    DEFAULT_DAILY_COST,
    TeamSetup,
    SimConfig,
    run_to_completion,
    compute_finance,
    build_takt_grid,
    day_to_week,
)

ROOT = Path(__file__).resolve().parent
LOGO = ROOT / "assets" / "logo.png"
FAVICON = ROOT / "assets" / "favicon.png"

st.set_page_config(
    page_title="Rusun Takt",
    page_icon=str(FAVICON) if FAVICON.exists() else "🏗️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

st.markdown(
    """
<style>
  /* Sembunyikan sidebar sepenuhnya — setup di konten utama seperti sandbox */
  [data-testid="stSidebar"],
  [data-testid="stSidebarCollapsedControl"],
  section[data-testid="stSidebar"] {
    display: none !important;
  }
  .stApp {
    background: linear-gradient(165deg, #e0f2fe 0%, #f0f9ff 42%, #fff7ed 100%);
  }
  .block-container {
    padding-top: 1.1rem;
    padding-bottom: 2rem;
    max-width: 980px;
  }
  .hero {
    display: flex; align-items: center; gap: 1rem;
    background: #fff; border: 2px solid #7dd3fc; border-radius: 16px;
    padding: 1rem 1.15rem; margin-bottom: .85rem;
    box-shadow: 0 8px 22px rgba(14,165,233,.10);
  }
  .hero img {
    width: 80px; height: 80px; border-radius: 14px; object-fit: cover;
    border: 2px solid #fde68a; background: #fff; flex-shrink: 0;
  }
  .hero h1 { margin: 0; font-size: 1.75rem; color: #0c4a6e; font-weight: 800; }
  .hero p { margin: .3rem 0 0; color: #475569; font-size: .95rem; line-height: 1.4; }
  .badge-row { margin-top: .45rem; display: flex; flex-wrap: wrap; gap: .35rem; }
  .badge {
    display: inline-block; border-radius: 999px; padding: .12rem .55rem;
    font-size: .72rem; font-weight: 600; border: 1px solid #fcd34d;
    background: #fef3c7; color: #92400e;
  }
  .badge.blue { background: #e0f2fe; color: #075985; border-color: #7dd3fc; }
  .badge.green { background: #dcfce7; color: #166534; border-color: #86efac; }
  .panel {
    background: #fff; border: 1px solid #bae6fd; border-radius: 14px;
    padding: 1rem 1.1rem; margin-bottom: .85rem;
    box-shadow: 0 3px 12px rgba(15,23,42,.04);
  }
  .panel h2 {
    margin: 0 0 .15rem; font-size: 1.2rem; color: #0c4a6e; font-weight: 700;
  }
  .panel .sub { color: #64748b; font-size: .8rem; margin-bottom: .75rem; }
  .rules p { color: #475569; font-size: .9rem; line-height: 1.45; margin: .4rem 0; }
  .rules strong { color: #0f172a; }
  .team-dot {
    display: inline-flex; align-items: center; justify-content: center;
    width: 1.55rem; height: 1.55rem; border-radius: 999px;
    color: #fff; font-size: .7rem; font-weight: 800; margin-right: .4rem;
  }
  h3 { color: #0c4a6e !important; }
  .zone-tile {
    border-radius: 12px; padding: 12px 8px; text-align: center; color: #fff;
    min-height: 68px; font-weight: 700; box-shadow: 0 3px 10px rgba(0,0,0,.12);
  }
</style>
""",
    unsafe_allow_html=True,
)


def fmt_rp(n: float) -> str:
    try:
        return "Rp {:,.0f}".format(float(n)).replace(",", ".")
    except Exception:
        return str(n)


def start_label(sw: int) -> str:
    return "JIT" if int(sw) == START_JIT else "Minggu {}".format(int(sw) + 1)


def hero() -> None:
    img = ""
    if LOGO.exists():
        b64 = base64.b64encode(LOGO.read_bytes()).decode("ascii")
        img = '<img src="data:image/png;base64,{}" alt="Logo Rusun Takt" />'.format(b64)
    st.markdown(
        """
<div class="hero">
  {img}
  <div>
    <h1>Rusun Takt</h1>
    <p>Simulasi parade tim kerja dan metodologi Takt. Pembelajaran dampak dari metode dorong (push), pengembangan kapasitas (capacity building) dan aliran (flow) dengan pendekatan Takt.</p>
    <div class="badge-row">
      <span class="badge blue">3 lantai</span>
      <span class="badge">5 zona / lantai</span>
      <span class="badge green">7 wagon</span>
      <span class="badge blue">1 minggu = 7 hari</span>
    </div>
  </div>
</div>
""".format(img=img),
        unsafe_allow_html=True,
    )


def main() -> None:
    hero()

    # —— Aturan Aliran Kerja (seperti sandbox) ——
    st.markdown(
        """
<div class="panel rules">
  <h2>Aturan Aliran Kerja</h2>
  <div class="sub">Baca manual dulu sebelum menjalankan simulasi.</div>
  <p><strong>1. Siapa memulai.</strong> Wagon depan adalah <strong>Struktur</strong> (kolom & balok). Urutan tetap: Struktur → Pelat → Dinding → MEP → Plester → Keramik → Cat.</p>
  <p><strong>2. Satu zona, satu tim.</strong> Per lantai ada 5 zona: <strong>{zones}</strong>. Tidak boleh dua tim di zona yang sama. Tim berikutnya baru masuk setelah tim sebelumnya meninggalkan zona itu (paling cepat hari berikutnya).</p>
  <p><strong>3. Alur zona.</strong> Tiap tim mengerjakan zona berurutan: U1 → U2 → Tangga → U3 → U4, lalu naik ke lantai berikutnya dengan pola yang sama.</p>
  <p><strong>4. Curing beton ({curing} hari).</strong> Setelah <strong>Pelat</strong> selesai di suatu zona, zona itu di-curing {curing} hari, baru bekisting dilepas. Tim Dinding (dan setelahnya) baru boleh masuk setelah curing selesai. Struktur ke lantai atas menunggu curing zona di bawahnya.</p>
  <p><strong>5. Start Kerja.</strong> <strong>Minggu 1–7</strong> = tim sudah di site (dibayar) sejak minggu itu meski belum dapat zona (push → bisa waste). <strong>JIT</strong> = tim baru mulai (dan dibayar) segera saat zona pertama kali boleh dimasuki.</p>
</div>
""".format(zones=" · ".join(ZONE_LABELS), curing=CURING_DAYS),
        unsafe_allow_html=True,
    )

    with st.expander("📖 Baca manual lengkap", expanded=False):
        st.markdown(
            """
- **Parade of trades**: barisan wagon, satu zona hanya satu tim.
- **Push** (start minggu tetap) vs **JIT** (masuk tepat waktu).
- **Variasi kapasitas**: min–max hari per zona (contoh 1–6 acak, 7–7 konstan).
- **Waste**: tim di site tapi menunggu — tetap dibayar.
- **Penalti** = hari terlambat × (1/1000) × kontrak.
- **Margin** = kontrak − biaya tenaga − penalti.
- **1 minggu = {week} hari**.
            """.format(week=DAYS_PER_WEEK)
        )

    # —— Setup (main content, bukan sidebar) ——
    st.markdown(
        """
<div class="panel">
  <h2>Setup tim kerja</h2>
  <div class="sub">Start Kerja (M1–M7 / JIT) · variasi kapasitas · target owner & kontrak</div>
</div>
""",
        unsafe_allow_html=True,
    )

    c1, c2, c3 = st.columns(3)
    with c1:
        owner_days = st.number_input(
            "Durasi owner (hari)",
            min_value=1,
            value=int(DEFAULT_OWNER_DURATION),
            help="Default 120 hari",
        )
    with c2:
        contract_jt = st.number_input(
            "Nilai kontrak (juta Rp)",
            min_value=0,
            value=int(DEFAULT_CONTRACT_VALUE // 1_000_000),
            help="Default 210 jt",
        )
    with c3:
        seed = st.number_input("Seed acak", min_value=0, value=42)

    st.caption(
        "Penalti = hari terlambat × (1/1000) × kontrak. "
        "Margin = kontrak − biaya tenaga − penalti."
    )

    preset = st.radio(
        "Preset cepat",
        ["Push · Minggu 1 · variasi 1–6", "JIT · variasi 7–7 (konstan)"],
        horizontal=True,
        index=0,
    )
    if preset.startswith("JIT"):
        default_sw, default_lo, default_hi = START_JIT, 7, 7
    else:
        default_sw, default_lo, default_hi = 0, 1, 6

    start_options = list(range(7)) + [START_JIT]

    def fmt_start(x: int) -> str:
        return "Just-in-Time (JIT)" if x == START_JIT else "Minggu {}".format(x + 1)

    team_rows: list[TeamSetup] = []
    st.markdown("##### Tim kerja")

    # Header row
    h1, h2, h3, h4, h5 = st.columns([1.4, 1.4, 0.8, 0.8, 1.0])
    h1.caption("TIM KERJA")
    h2.caption("START KERJA")
    h3.caption("BAWAH")
    h4.caption("ATAS")
    h5.caption("BIAYA / HARI (× Rp1.000)")

    for i, defn in enumerate(TEAMS):
        col_name, col_start, col_lo, col_hi, col_cost = st.columns(
            [1.4, 1.4, 0.8, 0.8, 1.0]
        )
        with col_name:
            st.markdown(
                '<span class="team-dot" style="background:{c}">{n}</span> **{name}**'.format(
                    c=defn["color"], n=i + 1, name=defn["short"]
                ),
                unsafe_allow_html=True,
            )
        with col_start:
            start = st.selectbox(
                "Start {}".format(i),
                start_options,
                index=start_options.index(default_sw),
                format_func=fmt_start,
                key="start_{}".format(i),
                label_visibility="collapsed",
            )
        with col_lo:
            lo = st.number_input(
                "lo{}".format(i),
                1,
                9,
                int(default_lo),
                key="lo_{}".format(i),
                label_visibility="collapsed",
            )
        with col_hi:
            hi = st.number_input(
                "hi{}".format(i),
                1,
                9,
                int(default_hi),
                key="hi_{}".format(i),
                label_visibility="collapsed",
            )
        with col_cost:
            cost_ui = st.number_input(
                "cost{}".format(i),
                min_value=0,
                value=int(DEFAULT_DAILY_COST // 1000),
                step=10,
                key="cost_{}".format(i),
                label_visibility="collapsed",
            )
        team_rows.append(
            TeamSetup(
                start_week=int(start),
                dice_min=int(lo),
                dice_max=int(hi),
                daily_cost=int(cost_ui) * 1000,
            )
        )

    run_btn = st.button("▶ Start / Jalankan simulasi", type="primary", use_container_width=True)

    if run_btn:
        cfg = SimConfig(
            teams=team_rows,
            owner_duration_days=int(owner_days),
            contract_value=int(contract_jt) * 1_000_000,
        )
        with st.spinner("Menjalankan simulasi…"):
            final = run_to_completion(cfg, seed=int(seed))
        st.session_state["result"] = final

    if "result" not in st.session_state:
        st.info(
            "Atur setup di atas, pilih preset Push atau JIT, lalu klik "
            "**Start / Jalankan simulasi**."
        )
        return

    final = st.session_state["result"]
    m = final.metrics
    fin = compute_finance(
        final.config,
        m.finish_day or m.day,
        m.total_cost,
        m.waste_cost,
        True,
    )

    st.success(
        "Selesai hari **{}** (minggu ke-{})".format(
            m.finish_day, day_to_week(m.finish_day or 0)
        )
    )

    k1, k2, k3, k4, k5 = st.columns(5)
    k1.metric("Durasi (hari)", m.finish_day or m.day)
    k2.metric("Biaya tenaga", fmt_rp(fin["labor_cost"]))
    k3.metric("Waste", fmt_rp(fin["waste_cost"]))
    k4.metric("Penalti", fmt_rp(fin["penalty"]))
    k5.metric("Margin", fmt_rp(fin["margin"]), "{:.1f}%".format(fin["margin_pct"]))

    st.subheader("Hasil per tim")
    header = [
        "Tim",
        "Start",
        "Variasi",
        "Minggu selesai",
        "Hari kerja",
        "Tak terpakai",
        "Maks",
        "Min",
        "Rata-rata",
        "Waste (Rp)",
    ]
    body = []
    for i, t in enumerate(final.teams):
        durs = t.zone_durations or [0]
        body.append(
            [
                TEAMS[i]["short"],
                start_label(final.config.teams[i].start_week),
                "{}–{}".format(
                    final.config.teams[i].dice_min, final.config.teams[i].dice_max
                ),
                day_to_week(t.finish_day) if t.finish_day else "—",
                t.capacity_total,
                t.unused_capacity,
                max(durs) if durs else 0,
                min(durs) if durs else 0,
                round(sum(durs) / len(durs), 1) if durs else 0,
                int(t.waste_cost),
            ]
        )
    md = "| " + " | ".join(str(h) for h in header) + " |\n"
    md += "| " + " | ".join(["---"] * len(header)) + " |\n"
    for row in body:
        md += "| " + " | ".join(str(c) for c in row) + " |\n"
    st.markdown(md)

    st.subheader("Progress wagon (zona selesai / {})".format(TOTAL_UNITS))
    for i, t in enumerate(final.teams):
        pct = min(100, int(round(100 * t.progress / TOTAL_UNITS))) if TOTAL_UNITS else 0
        c1, c2 = st.columns([1.2, 4])
        with c1:
            st.markdown(
                '<span class="team-dot" style="background:{c}">{n}</span> **{name}**'.format(
                    c=TEAMS[i]["color"], n=i + 1, name=TEAMS[i]["short"]
                ),
                unsafe_allow_html=True,
            )
        with c2:
            st.progress(pct / 100.0, text="{} / {} zona".format(t.progress, TOTAL_UNITS))

    st.subheader("Takt plan (minggu)")
    st.caption(
        "1 minggu = {} hari. Sel = nama tim. Kosong = idle/curing.".format(DAYS_PER_WEEK)
    )
    weeks, work = build_takt_grid(final.history)
    zone_names = [
        "{}.{}".format(f + 1, ZONE_LABELS[zi])
        for f in range(FLOORS)
        for zi in range(UNITS_PER_FLOOR)
    ]
    takt_header = ["Zona"] + ["M{}".format(w + 1) for w in range(weeks)]
    takt_body = [[zone_names[z]] + work[z] for z in range(TOTAL_UNITS)]
    md = "| " + " | ".join(str(h) for h in takt_header) + " |\n"
    md += "| " + " | ".join(["---"] * len(takt_header)) + " |\n"
    for row in takt_body:
        md += (
            "| "
            + " | ".join(str(c) if c != "" else " " for c in row)
            + " |\n"
        )
    st.markdown(md)

    st.subheader("Ilustrasi zona")
    last_progress = final.teams[-1].progress
    for f in range(FLOORS - 1, -1, -1):
        cols = st.columns(5)
        for zi in range(5):
            z = f * UNITS_PER_FLOOR + zi
            done = last_progress > z
            highest = -1
            for ti, t in enumerate(final.teams):
                if t.progress > z:
                    highest = ti
            color = TEAMS[highest]["color"] if highest >= 0 else "#94a3b8"
            check = " ✓" if done else ""
            cols[zi].markdown(
                '<div class="zone-tile" style="background:{color};'
                'border:3px solid {border}">'
                '<div style="font-size:11px;opacity:.9;font-weight:600">Lt.{floor}</div>'
                '<div>{label}{check}</div></div>'.format(
                    color=color,
                    border="#22c55e" if done else "transparent",
                    floor=f + 1,
                    label=ZONE_LABELS[zi],
                    check=check,
                ),
                unsafe_allow_html=True,
            )

    with st.expander("Log"):
        for line in reversed(final.log[-25:]):
            st.text(line)

    st.caption("Rusun Takt · github.com/m46d45/rusun-takt")


try:
    main()
except Exception:
    st.error("Terjadi error saat menjalankan app:")
    st.code(traceback.format_exc())
