# -*- coding: utf-8 -*-
"""Rusun Takt — Streamlit (minimal deps for fast Cloud install)."""
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
LOGO_SM = ROOT / "assets" / "logo_sm.png"
FAVICON = ROOT / "assets" / "favicon.png"

st.set_page_config(
    page_title="Rusun Takt",
    page_icon=str(FAVICON) if FAVICON.exists() else "🏗️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
<style>
  .stApp {
    background: linear-gradient(165deg, #e0f2fe 0%, #f0f9ff 40%, #fff7ed 100%);
  }
  [data-testid="stSidebar"] {
    background: linear-gradient(180deg, #ffffff 0%, #e0f2fe 100%);
    border-right: 1px solid #bae6fd;
  }
  .block-container { padding-top: 1rem; max-width: 1100px; }
  .hero {
    display: flex; align-items: center; gap: 1.1rem;
    background: #ffffff; border: 2px solid #7dd3fc; border-radius: 18px;
    padding: 1rem 1.25rem; box-shadow: 0 8px 24px rgba(14,165,233,.12);
    margin-bottom: .75rem;
  }
  .hero img {
    width: 88px; height: 88px; border-radius: 16px; object-fit: cover;
    border: 2px solid #fde68a; background: #fff;
  }
  .hero h1 { margin: 0; font-size: 1.85rem; color: #0c4a6e; font-weight: 800; }
  .hero p { margin: .25rem 0 0; color: #475569; font-size: .98rem; }
  .badge-row { margin-top: .45rem; display: flex; flex-wrap: wrap; gap: .35rem; }
  .badge {
    display: inline-block; border-radius: 999px; padding: .15rem .55rem;
    font-size: .75rem; font-weight: 600; border: 1px solid #fcd34d;
    background: #fef3c7; color: #92400e;
  }
  .badge.blue { background: #e0f2fe; color: #075985; border-color: #7dd3fc; }
  .badge.green { background: #dcfce7; color: #166534; border-color: #86efac; }
  .card {
    background: #fff; border: 1px solid #bae6fd; border-radius: 14px;
    padding: .9rem 1rem; margin: .6rem 0 1rem;
  }
  h2, h3 { color: #0c4a6e !important; }
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
    img_html = ""
    if LOGO.exists():
        b64 = base64.b64encode(LOGO.read_bytes()).decode("ascii")
        img_html = '<img src="data:image/png;base64,{}" alt="Logo Rusun Takt" />'.format(
            b64
        )
    st.markdown(
        """
<div class="hero">
  {img}
  <div>
    <h1>Rusun Takt</h1>
    <p>Simulasi lean construction untuk rusun 3 lantai — parade of trades, push vs JIT, waste & margin.</p>
    <div class="badge-row">
      <span class="badge blue">3 lantai</span>
      <span class="badge">5 zona / lantai</span>
      <span class="badge green">7 wagon</span>
      <span class="badge blue">1 minggu = 7 hari</span>
    </div>
  </div>
</div>
""".format(
            img=img_html
        ),
        unsafe_allow_html=True,
    )


def main() -> None:
    hero()

    with st.expander("Manual singkat", expanded=False):
        st.markdown(
            """
1. **Wagon** berurutan: Struktur → Pelat → Dinding → MEP → Plester → Keramik → Cat
2. **Satu zona, satu tim** — berikutnya masuk setelah wagon depan lepas
3. Setelah **Pelat** selesai di zona, curing **{curing} hari** penuh
4. **Minggu 1–7** = push (dibayar meski menunggu). **JIT** = bayar saat zona siap
5. Penalti = hari terlambat × (1/1000) × kontrak
6. Margin = kontrak − biaya tenaga − penalti
7. **1 minggu = {week} hari**
            """.format(
                curing=CURING_DAYS, week=DAYS_PER_WEEK
            )
        )

    with st.sidebar:
        if LOGO_SM.exists():
            st.image(str(LOGO_SM), width=96)
        st.markdown("### Setup simulasi")
        owner_days = st.number_input(
            "Durasi owner (hari)", min_value=1, value=int(DEFAULT_OWNER_DURATION)
        )
        contract_jt = st.number_input(
            "Nilai kontrak (juta Rp)",
            min_value=0,
            value=int(DEFAULT_CONTRACT_VALUE // 1_000_000),
        )
        seed = st.number_input("Seed acak", min_value=0, value=42)

        mode = st.radio(
            "Preset",
            ["Push · Minggu 1 · variasi 1–6", "JIT · variasi 7–7 (konstan)"],
            index=0,
        )
        if mode.startswith("JIT"):
            default_sw = START_JIT
            default_lo, default_hi = 7, 7
        else:
            default_sw = 0
            default_lo, default_hi = 1, 6

        st.markdown("#### Tim kerja")
        team_rows = []
        start_options = list(range(7)) + [START_JIT]

        def fmt_start(x: int) -> str:
            return "Just-in-Time (JIT)" if x == START_JIT else "Minggu {}".format(x + 1)

        for i, defn in enumerate(TEAMS):
            with st.expander("{}. {}".format(i + 1, defn["short"]), expanded=(i == 0)):
                start = st.selectbox(
                    "Start Kerja",
                    start_options,
                    index=start_options.index(default_sw),
                    format_func=fmt_start,
                    key="start_{}".format(i),
                )
                c1, c2 = st.columns(2)
                lo = c1.number_input(
                    "Min hari", 1, 9, int(default_lo), key="lo_{}".format(i)
                )
                hi = c2.number_input(
                    "Max hari", 1, 9, int(default_hi), key="hi_{}".format(i)
                )
                cost_ui = st.number_input(
                    "Biaya/hari (× Rp1.000)",
                    min_value=0,
                    value=int(DEFAULT_DAILY_COST // 1000),
                    step=10,
                    key="cost_{}".format(i),
                )
                team_rows.append(
                    TeamSetup(
                        start_week=int(start),
                        dice_min=int(lo),
                        dice_max=int(hi),
                        daily_cost=int(cost_ui) * 1000,
                    )
                )

        run_btn = st.button("Jalankan simulasi", type="primary", use_container_width=True)

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
        st.markdown(
            """
<div class="card">
  <strong>Mulai di sini</strong><br/>
  Atur setup di sidebar, pilih preset <em>Push</em> atau <em>JIT</em>,
  lalu klik <strong>Jalankan simulasi</strong>.
</div>
""",
            unsafe_allow_html=True,
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
    # tabel markdown (tanpa pandas)
    md = "| " + " | ".join(str(h) for h in header) + " |\n"
    md += "| " + " | ".join(["---"] * len(header)) + " |\n"
    for row in body:
        md += "| " + " | ".join(str(c) for c in row) + " |\n"
    st.markdown(md)

    st.subheader("Progress wagon (zona selesai / {})".format(TOTAL_UNITS))
    chart_data = {
        TEAMS[i]["short"]: t.progress for i, t in enumerate(final.teams)
    }
    st.bar_chart(chart_data)

    st.subheader("Takt plan (minggu)")
    st.caption(
        "1 minggu = {} hari. Sel = nama tim. Kosong = idle/curing.".format(
            DAYS_PER_WEEK
        )
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
        md += "| " + " | ".join(str(c) if c != "" else " " for c in row) + " |\n"
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
