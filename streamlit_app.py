"""
Rusun Takt — Streamlit app
Deploy: Streamlit Community Cloud → repo m46d45/rusun-takt → streamlit_app.py
"""
from __future__ import annotations

import streamlit as st
import pandas as pd
import plotly.graph_objects as go

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
    zone_label,
)

st.set_page_config(
    page_title="Rusun Takt",
    page_icon="🏗️",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
<style>
  .block-container { padding-top: 1.2rem; }
  div[data-testid="stMetricValue"] { font-variant-numeric: tabular-nums; }
</style>
""",
    unsafe_allow_html=True,
)


def fmt_rp(n: float) -> str:
    return f"Rp {n:,.0f}".replace(",", ".")


def start_label(sw: int) -> str:
    return "JIT" if sw == START_JIT else f"Minggu {sw + 1}"


with st.sidebar:
    st.title("Rusun Takt")
    st.caption(
        "Simulasi lean construction · parade of trades · push vs JIT"
    )
    st.markdown("---")
    st.subheader("Kontrak & owner")
    owner_days = st.number_input(
        "Durasi owner (hari)", min_value=1, value=DEFAULT_OWNER_DURATION, step=1
    )
    contract_jt = st.number_input(
        "Nilai kontrak (juta Rp)",
        min_value=0,
        value=DEFAULT_CONTRACT_VALUE // 1_000_000,
        step=1,
    )
    seed = st.number_input("Seed acak", min_value=0, value=42, step=1)

    st.markdown("---")
    st.subheader("Preset cepat")
    col_a, col_b = st.columns(2)
    with col_a:
        if st.button("Semua JIT · 7–7", use_container_width=True):
            st.session_state["preset"] = "jit77"
    with col_b:
        if st.button("Push M1 · 1–6", use_container_width=True):
            st.session_state["preset"] = "push16"

    preset = st.session_state.get("preset", "push16")
    default_jit = preset == "jit77"
    default_lo = 7 if preset == "jit77" else 1
    default_hi = 7 if preset == "jit77" else 6
    default_sw = START_JIT if default_jit else 0

    st.markdown("---")
    st.subheader("Setup tim kerja")
    team_rows = []
    for i, defn in enumerate(TEAMS):
        with st.expander(f"{i + 1}. {defn['short']}", expanded=(i == 0)):
            sw_opts = list(range(7)) + [START_JIT]
            sw_labels = {w: f"Minggu {w + 1}" for w in range(7)}
            sw_labels[START_JIT] = "Just-in-Time (JIT)"
            start = st.selectbox(
                "Start Kerja",
                sw_opts,
                index=sw_opts.index(default_sw) if default_sw in sw_opts else 0,
                format_func=lambda x: sw_labels[x],
                key=f"sw_{i}_{preset}",
            )
            c1, c2 = st.columns(2)
            lo = c1.number_input(
                "Variasi bawah",
                1,
                9,
                default_lo,
                key=f"lo_{i}_{preset}",
            )
            hi = c2.number_input(
                "Variasi atas",
                1,
                9,
                default_hi,
                key=f"hi_{i}_{preset}",
            )
            cost_ui = st.number_input(
                "Biaya/hari (× Rp1.000)",
                min_value=0,
                value=DEFAULT_DAILY_COST // 1000,
                step=10,
                key=f"cost_{i}",
            )
            team_rows.append(
                TeamSetup(
                    start_week=int(start),
                    dice_min=int(lo),
                    dice_max=int(hi),
                    daily_cost=int(cost_ui) * 1000,
                )
            )

    run_btn = st.button("▶ Jalankan simulasi", type="primary", use_container_width=True)

st.title("🏗️ Rusun Takt")
st.markdown(
    f"""
Simulasi pendidikan **lean construction** untuk rusun 3 lantai
(5 zona: {" · ".join(ZONE_LABELS)}).
Curing pelat **{CURING_DAYS} hari** · **1 minggu = {DAYS_PER_WEEK} hari**.
Satu zona hanya satu tim. Menunggu = waste.
"""
)

with st.expander("📖 Manual singkat", expanded=False):
    st.markdown(
        f"""
1. **Wagon** berurutan: Struktur → Pelat → Dinding → MEP → Plester → Keramik → Cat  
2. **Satu zona, satu tim** — berikutnya masuk setelah wagon depan lepas  
3. Setelah **Pelat** selesai di zona, curing **{CURING_DAYS} hari** penuh  
4. **Minggu 1–7** = push (dibayar meski menunggu). **JIT** = baru bayar saat zona siap  
5. Penalti = hari terlambat × (1/1000) × kontrak  
6. Margin = kontrak − biaya tenaga − penalti  
        """
    )

if run_btn or "result" in st.session_state:
    if run_btn:
        cfg = SimConfig(
            teams=team_rows,
            owner_duration_days=int(owner_days),
            contract_value=int(contract_jt) * 1_000_000,
        )
        with st.spinner("Menjalankan simulasi…"):
            final = run_to_completion(cfg, seed=int(seed))
        st.session_state["result"] = final

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
        f"Selesai hari **{m.finish_day}** (minggu ke-{day_to_week(m.finish_day or 0)})"
    )

    k1, k2, k3, k4, k5 = st.columns(5)
    k1.metric("Durasi (hari)", m.finish_day or m.day)
    k2.metric("Biaya tenaga", fmt_rp(fin["labor_cost"]))
    k3.metric("Waste", fmt_rp(fin["waste_cost"]))
    k4.metric("Penalti", fmt_rp(fin["penalty"]))
    k5.metric("Margin", fmt_rp(fin["margin"]), f'{fin["margin_pct"]:.1f}%')

    # Team table
    st.subheader("Hasil per tim")
    rows = []
    for i, t in enumerate(final.teams):
        durs = t.zone_durations or [0]
        rows.append(
            {
                "Tim": TEAMS[i]["short"],
                "Start": start_label(final.config.teams[i].start_week),
                "Variasi": f"{final.config.teams[i].dice_min}–{final.config.teams[i].dice_max}",
                "Minggu selesai": day_to_week(t.finish_day) if t.finish_day else "—",
                "Total hari kerja": t.capacity_total,
                "Tak terpakai": t.unused_capacity,
                "Maks (hari)": max(durs) if durs else 0,
                "Min (hari)": min(durs) if durs else 0,
                "Rata-rata": round(sum(durs) / len(durs), 1) if durs else 0,
                "Waste (Rp)": t.waste_cost,
            }
        )
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    # Progress per team
    st.subheader("Progress wagon")
    prog = pd.DataFrame(
        {
            "Tim": [t["short"] for t in TEAMS],
            "Zona selesai": [t.progress for t in final.teams],
        }
    )
    fig_bar = go.Figure(
        go.Bar(
            x=prog["Zona selesai"],
            y=prog["Tim"],
            orientation="h",
            marker_color=[t["color"] for t in TEAMS],
            text=prog["Zona selesai"],
            textposition="outside",
        )
    )
    fig_bar.update_layout(
        height=320,
        margin=dict(l=10, r=10, t=10, b=10),
        xaxis=dict(title="Zona (0–15)", range=[0, TOTAL_UNITS + 1]),
        yaxis=dict(autorange="reversed"),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font=dict(color="#e8eef9"),
    )
    st.plotly_chart(fig_bar, use_container_width=True)

    # Takt plan heatmap-like table
    st.subheader("Takt plan — timeline minggu")
    st.caption(f"1 minggu = {DAYS_PER_WEEK} hari · putih = kosong/curing")
    weeks, work = build_takt_grid(final.history)
    zone_names = [
        f"{f + 1}.{ZONE_LABELS[zi]}"
        for f in range(FLOORS)
        for zi in range(UNITS_PER_FLOOR)
    ]
    takt_df = pd.DataFrame(
        work,
        index=zone_names,
        columns=[f"M{w + 1}" for w in range(weeks)],
    )
    st.dataframe(takt_df, use_container_width=True)

    # Color legend
    legend = " · ".join(
        f'<span style="color:{t["color"]};font-weight:700">{i + 1}. {t["short"]}</span>'
        for i, t in enumerate(TEAMS)
    )
    st.markdown(legend, unsafe_allow_html=True)

    # Building snapshot: last team progress per zone
    st.subheader("Ilustrasi zona (cek hijau = cat sudah lewat)")
    last_progress = final.teams[-1].progress
    for f in range(FLOORS - 1, -1, -1):
        cols = st.columns(5)
        for zi in range(5):
            z = f * UNITS_PER_FLOOR + zi
            done = last_progress > z
            label = ZONE_LABELS[zi]
            # who is "highest" team past this zone
            highest = -1
            for ti, t in enumerate(final.teams):
                if t.progress > z:
                    highest = ti
            color = TEAMS[highest]["color"] if highest >= 0 else "#334155"
            check = " ✓" if done else ""
            cols[zi].markdown(
                f"""
<div style="background:{color};border-radius:10px;padding:10px 8px;text-align:center;
color:#fff;min-height:64px;border:2px solid {'#34d399' if done else 'transparent'}">
  <div style="font-size:11px;opacity:.85">Lt.{f + 1}</div>
  <div style="font-weight:700">{label}{check}</div>
</div>
""",
                unsafe_allow_html=True,
            )

    with st.expander("Log terakhir"):
        for line in reversed(final.log[-20:]):
            st.text(line)

else:
    st.info(
        "Atur setup di sidebar kiri, lalu klik **Jalankan simulasi**. "
        "Coba bandingkan preset **Push M1 · 1–6** vs **Semua JIT · 7–7**."
    )

st.markdown("---")
st.caption(
    "Rusun Takt · edukasi lean construction · "
    "[GitHub](https://github.com/m46d45/rusun-takt)"
)
