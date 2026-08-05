# -*- coding: utf-8 -*-
"""Rusun Takt — Streamlit Community Cloud entrypoint."""
from __future__ import annotations

import traceback

import pandas as pd
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

st.set_page_config(
    page_title="Rusun Takt",
    page_icon="🏗️",
    layout="wide",
    initial_sidebar_state="expanded",
)


def fmt_rp(n: float) -> str:
    try:
        return "Rp {:,.0f}".format(float(n)).replace(",", ".")
    except Exception:
        return str(n)


def start_label(sw: int) -> str:
    return "JIT" if int(sw) == START_JIT else "Minggu {}".format(int(sw) + 1)


def main() -> None:
    st.title("Rusun Takt")
    st.caption(
        "Simulasi lean construction · parade of trades · push vs JIT · "
        "rusun 3 lantai"
    )

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
        st.header("Setup")
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

        st.subheader("Tim kerja")
        team_rows = []
        start_options = list(range(7)) + [START_JIT]

        def fmt_start(x: int) -> str:
            return "Just-in-Time (JIT)" if x == START_JIT else "Minggu {}".format(x + 1)

        for i, defn in enumerate(TEAMS):
            st.markdown("**{}. {}**".format(i + 1, defn["short"]))
            c1, c2, c3 = st.columns(3)
            start = c1.selectbox(
                "Start",
                start_options,
                index=start_options.index(default_sw),
                format_func=fmt_start,
                key="start_{}".format(i),
            )
            lo = c2.number_input(
                "Min hari",
                min_value=1,
                max_value=9,
                value=int(default_lo),
                key="lo_{}".format(i),
            )
            hi = c3.number_input(
                "Max hari",
                min_value=1,
                max_value=9,
                value=int(default_hi),
                key="hi_{}".format(i),
            )
            cost_ui = st.number_input(
                "Biaya/hari (x Rp1000)",
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
            st.divider()

        run_btn = st.button("Jalankan simulasi", type="primary", use_container_width=True)

    if run_btn:
        cfg = SimConfig(
            teams=team_rows,
            owner_duration_days=int(owner_days),
            contract_value=int(contract_jt) * 1_000_000,
        )
        with st.spinner("Menjalankan simulasi..."):
            final = run_to_completion(cfg, seed=int(seed))
        st.session_state["result"] = final

    if "result" not in st.session_state:
        st.info(
            "Atur setup di sidebar, lalu klik **Jalankan simulasi**. "
            "Bandingkan preset Push vs JIT."
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
    rows = []
    for i, t in enumerate(final.teams):
        durs = t.zone_durations or [0]
        rows.append(
            {
                "Tim": TEAMS[i]["short"],
                "Start": start_label(final.config.teams[i].start_week),
                "Variasi": "{}–{}".format(
                    final.config.teams[i].dice_min, final.config.teams[i].dice_max
                ),
                "Minggu selesai": day_to_week(t.finish_day) if t.finish_day else "—",
                "Total hari kerja": t.capacity_total,
                "Tak terpakai": t.unused_capacity,
                "Maks": max(durs) if durs else 0,
                "Min": min(durs) if durs else 0,
                "Rata-rata": round(sum(durs) / len(durs), 1) if durs else 0,
                "Waste (Rp)": int(t.waste_cost),
            }
        )
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    st.subheader("Progress wagon (zona selesai / {})".format(TOTAL_UNITS))
    prog = pd.DataFrame(
        {"Zona selesai": [t.progress for t in final.teams]},
        index=[t["short"] for t in TEAMS],
    )
    st.bar_chart(prog)

    st.subheader("Takt plan (minggu)")
    st.caption(
        "1 minggu = {} hari. Sel berisi nama tim. Kosong = idle/curing.".format(
            DAYS_PER_WEEK
        )
    )
    weeks, work = build_takt_grid(final.history)
    zone_names = [
        "{}.{}".format(f + 1, ZONE_LABELS[zi])
        for f in range(FLOORS)
        for zi in range(UNITS_PER_FLOOR)
    ]
    takt_df = pd.DataFrame(
        work,
        index=zone_names,
        columns=["M{}".format(w + 1) for w in range(weeks)],
    )
    st.dataframe(takt_df, use_container_width=True)

    st.subheader("Zona (hijau = selesai semua wagon)")
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
            color = TEAMS[highest]["color"] if highest >= 0 else "#334155"
            check = " OK" if done else ""
            cols[zi].markdown(
                '<div style="background:{color};border-radius:10px;padding:10px;'
                'text-align:center;color:#fff;min-height:60px;'
                'border:2px solid {border}">'
                '<div style="font-size:11px;opacity:.85">Lt.{floor}</div>'
                '<div style="font-weight:700">{label}{check}</div></div>'.format(
                    color=color,
                    border="#34d399" if done else "transparent",
                    floor=f + 1,
                    label=ZONE_LABELS[zi],
                    check=check,
                ),
                unsafe_allow_html=True,
            )

    with st.expander("Log"):
        for line in reversed(final.log[-25:]):
            st.text(line)

    st.caption("Sumber: https://github.com/m46d45/rusun-takt")


try:
    main()
except Exception:
    st.error("Terjadi error saat menjalankan app:")
    st.code(traceback.format_exc())
