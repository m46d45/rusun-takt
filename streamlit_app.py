# -*- coding: utf-8 -*-
"""Rusun Takt — Streamlit dengan animasi hari-per-hari (mirip sandbox)."""
from __future__ import annotations

import base64
import time
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
    create_initial_state,
    step_day,
    create_rng,
    compute_finance,
    build_takt_grid,
    day_to_week,
    zone_label,
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

SPEED_MS = {
    "Lambat · 1 dtk/hari": 1.0,
    "Normal · 0,5 dtk": 0.45,
    "Cepat": 0.08,
    "Instan (tanpa animasi)": 0.0,
}

st.markdown(
    """
<style>
  [data-testid="stSidebar"],
  [data-testid="stSidebarCollapsedControl"],
  section[data-testid="stSidebar"] { display: none !important; }
  .stApp {
    background: linear-gradient(165deg, #e0f2fe 0%, #f0f9ff 42%, #fff7ed 100%);
  }
  .block-container { padding-top: 1rem; max-width: 980px; padding-bottom: 2rem; }
  .hero {
    display: flex; align-items: center; gap: 1rem;
    background: #fff; border: 2px solid #7dd3fc; border-radius: 16px;
    padding: 1rem 1.15rem; margin-bottom: .85rem;
    box-shadow: 0 8px 22px rgba(14,165,233,.10);
  }
  .hero img {
    width: 80px; height: 80px; border-radius: 14px; object-fit: cover;
    border: 2px solid #fde68a; flex-shrink: 0;
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
  .panel h2 { margin: 0 0 .15rem; font-size: 1.15rem; color: #0c4a6e; font-weight: 700; }
  .panel .sub { color: #64748b; font-size: .8rem; margin-bottom: .65rem; }
  .rules p { color: #475569; font-size: .88rem; line-height: 1.45; margin: .35rem 0; }
  .rules strong { color: #0f172a; }
  .team-dot {
    display: inline-flex; align-items: center; justify-content: center;
    width: 1.5rem; height: 1.5rem; border-radius: 999px;
    color: #fff; font-size: .68rem; font-weight: 800; margin-right: .35rem;
  }
  /* Building */
  .bld { border: 2px solid #6b7280; border-radius: 10px 10px 0 0; overflow: hidden; background: #f1f5f9; }
  .floor { display: grid; grid-template-columns: 1fr 1fr 0.55fr 1fr 1fr; border-bottom: 2px solid #94a3b8; min-height: 72px; }
  .floor:last-child { border-bottom: none; }
  .cell {
    position: relative; border-right: 1px solid #cbd5e1; background: #f8fafc;
    min-height: 72px; display: flex; align-items: center; justify-content: center;
  }
  .cell:last-child { border-right: none; }
  .cell.stair { background: #e2e8f0; }
  .cell .zl { position: absolute; top: 4px; left: 5px; font-size: 9px; color: #64748b; font-weight: 600; }
  .cell .fl { position: absolute; top: 4px; right: 5px; font-size: 9px; color: #334155; font-weight: 700;
    background: #fff; border-radius: 4px; padding: 0 4px; }
  .helm {
    width: 34px; height: 34px; border-radius: 50% 50% 45% 45%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 800; font-size: 13px;
    box-shadow: 0 2px 8px rgba(0,0,0,.25); border: 2px solid rgba(255,255,255,.7);
    transition: transform .25s ease;
  }
  .helm.work { transform: scale(1.12); box-shadow: 0 0 0 3px #38bdf8, 0 2px 8px rgba(0,0,0,.25); }
  .helm.wait { box-shadow: 0 0 0 3px #f87171, 0 2px 8px rgba(0,0,0,.2); opacity: .9; }
  .cell.done { background: #dcfce7 !important; }
  .cell.done::after {
    content: "✓"; position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center; color: #16a34a;
    font-size: 22px; font-weight: 800; opacity: .85;
  }
  .fond { background: #4b5563; color: #f1f5f9; text-align: center;
    padding: 8px; border-radius: 0 0 10px 10px; font-size: 11px;
    text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
  .status-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chip {
    font-size: 11px; padding: 3px 8px; border-radius: 999px;
    border: 1px solid #bae6fd; background: #f0f9ff; color: #0c4a6e;
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
        img = '<img src="data:image/png;base64,{}" alt="Logo" />'.format(b64)
    st.markdown(
        """
<div class="hero">
  {img}
  <div>
    <h1>Rusun Takt</h1>
    <p>Simulasi parade tim kerja dan metodologi Takt. Pembelajaran dampak dari metode dorong (push), pengembangan kapasitas, dan aliran (flow).</p>
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


def teams_visible_on_zone(teams, zone_idx: int):
    """Satu helm per zona: working dulu, else wagon terdepan yang menunggu."""
    cands = []
    for i, t in enumerate(teams):
        if t.progress >= TOTAL_UNITS or not t.mobilized:
            continue
        if t.status not in ("working", "blocked", "curing"):
            continue
        if t.progress != zone_idx:
            continue
        cands.append((i, t))
    if not cands:
        return None
    working = [c for c in cands if c[1].status == "working"]
    if working:
        return working[0]
    cands.sort(key=lambda x: x[0])
    return cands[0]


def render_building_html(state) -> str:
    last = state.teams[-1]
    floors_html = []
    for f in range(FLOORS - 1, -1, -1):
        cells = []
        for zi in range(UNITS_PER_FLOOR):
            z = f * UNITS_PER_FLOOR + zi
            done = last.progress > z
            is_stair = zi == 2
            vis = teams_visible_on_zone(state.teams, z)
            helm = ""
            if vis and not done:
                i, t = vis
                cls = "work" if t.status == "working" else "wait"
                helm = (
                    '<div class="helm {cls}" style="background:{c}" title="{title}">{n}</div>'
                ).format(
                    cls=cls,
                    c=TEAMS[i]["color"],
                    n=i + 1,
                    title="{} · {}".format(TEAMS[i]["short"], t.status_label),
                )
            # progress tint by highest team past zone
            bg = ""
            if done:
                cell_cls = "cell done" + (" stair" if is_stair else "")
            else:
                cell_cls = "cell stair" if is_stair else "cell"
                highest = -1
                for ti, t in enumerate(state.teams):
                    if t.progress > z:
                        highest = ti
                if highest >= 0:
                    bg = "background:{};".format(TEAMS[highest]["color"] + "33")
            fl_label = "Lt.{}".format(f + 1) if zi == 0 else ""
            cells.append(
                '<div class="{cls}" style="{bg}">'
                '<span class="zl">{lab}</span>'
                '{fl}'
                "{helm}"
                "</div>".format(
                    cls=cell_cls,
                    bg=bg,
                    lab=ZONE_LABELS[zi],
                    fl=('<span class="fl">{}</span>'.format(fl_label) if fl_label else ""),
                    helm=helm,
                )
            )
        floors_html.append('<div class="floor">{}</div>'.format("".join(cells)))

    chips = []
    for i, t in enumerate(state.teams):
        chips.append(
            '<span class="chip"><b style="color:{c}">{n}. {s}</b> · {st}</span>'.format(
                c=TEAMS[i]["color"],
                n=i + 1,
                s=TEAMS[i]["short"],
                st=t.status_label,
            )
        )

    return (
        '<div class="bld">{floors}</div>'
        '<div class="fond">Fondasi & sloof · Hari {day} · Minggu {week}</div>'
        '<div class="status-row">{chips}</div>'
    ).format(
        floors="".join(floors_html),
        day=state.day,
        week=day_to_week(state.day) if state.day else 0,
        chips="".join(chips),
    )


def init_session() -> None:
    if "sim_state" not in st.session_state:
        st.session_state.sim_state = None
    if "running" not in st.session_state:
        st.session_state.running = False
    if "rng" not in st.session_state:
        st.session_state.rng = None
    if "config" not in st.session_state:
        st.session_state.config = None


def collect_setup():
    c1, c2, c3 = st.columns(3)
    with c1:
        owner_days = st.number_input(
            "Durasi owner (hari)", min_value=1, value=int(DEFAULT_OWNER_DURATION)
        )
    with c2:
        contract_jt = st.number_input(
            "Nilai kontrak (juta Rp)",
            min_value=0,
            value=int(DEFAULT_CONTRACT_VALUE // 1_000_000),
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

    speed_label = st.select_slider(
        "Kecepatan animasi",
        options=list(SPEED_MS.keys()),
        value="Normal · 0,5 dtk",
    )

    start_options = list(range(7)) + [START_JIT]

    def fmt_start(x: int) -> str:
        return "Just-in-Time (JIT)" if x == START_JIT else "Minggu {}".format(x + 1)

    team_rows = []
    st.markdown("##### Tim kerja")
    h1, h2, h3, h4, h5 = st.columns([1.4, 1.4, 0.8, 0.8, 1.0])
    h1.caption("TIM KERJA")
    h2.caption("START KERJA")
    h3.caption("BAWAH")
    h4.caption("ATAS")
    h5.caption("BIAYA / HARI (× Rp1.000)")

    for i, defn in enumerate(TEAMS):
        a, b, c, d, e = st.columns([1.4, 1.4, 0.8, 0.8, 1.0])
        with a:
            st.markdown(
                '<span class="team-dot" style="background:{c}">{n}</span> **{name}**'.format(
                    c=defn["color"], n=i + 1, name=defn["short"]
                ),
                unsafe_allow_html=True,
            )
        with b:
            start = st.selectbox(
                "s{}".format(i),
                start_options,
                index=start_options.index(default_sw),
                format_func=fmt_start,
                key="start_{}".format(i),
                label_visibility="collapsed",
            )
        with c:
            lo = st.number_input(
                "lo{}".format(i), 1, 9, int(default_lo),
                key="lo_{}".format(i), label_visibility="collapsed",
            )
        with d:
            hi = st.number_input(
                "hi{}".format(i), 1, 9, int(default_hi),
                key="hi_{}".format(i), label_visibility="collapsed",
            )
        with e:
            cost_ui = st.number_input(
                "co{}".format(i),
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

    cfg = SimConfig(
        teams=team_rows,
        owner_duration_days=int(owner_days),
        contract_value=int(contract_jt) * 1_000_000,
    )
    return cfg, int(seed), SPEED_MS[speed_label]


def render_live_metrics(state) -> None:
    fin = compute_finance(
        state.config,
        state.metrics.finish_day or state.day,
        state.metrics.total_cost,
        state.metrics.waste_cost,
        state.finished,
    )
    a, b, c, d, e = st.columns(5)
    a.metric("Hari", state.day)
    b.metric("Biaya tenaga", fmt_rp(fin["labor_cost"]))
    c.metric("Waste", fmt_rp(fin["waste_cost"]))
    d.metric("Penalti", fmt_rp(fin["penalty"]))
    e.metric("Margin", fmt_rp(fin["margin"]), "{:.1f}%".format(fin["margin_pct"]))


def render_results(state) -> None:
    st.subheader("Hasil per tim")
    header = [
        "Tim", "Start", "Variasi", "Minggu selesai", "Hari kerja",
        "Tak terpakai", "Maks", "Min", "Rata-rata", "Waste (Rp)",
    ]
    body = []
    for i, t in enumerate(state.teams):
        durs = t.zone_durations or [0]
        body.append([
            TEAMS[i]["short"],
            start_label(state.config.teams[i].start_week),
            "{}–{}".format(state.config.teams[i].dice_min, state.config.teams[i].dice_max),
            day_to_week(t.finish_day) if t.finish_day else "—",
            t.capacity_total,
            t.unused_capacity,
            max(durs) if durs else 0,
            min(durs) if durs else 0,
            round(sum(durs) / len(durs), 1) if durs else 0,
            int(t.waste_cost),
        ])
    md = "| " + " | ".join(header) + " |\n| " + " | ".join(["---"] * len(header)) + " |\n"
    for row in body:
        md += "| " + " | ".join(str(x) for x in row) + " |\n"
    st.markdown(md)

    st.subheader("Takt plan (minggu)")
    weeks, work = build_takt_grid(state.history)
    zone_names = [
        "{}.{}".format(f + 1, ZONE_LABELS[zi])
        for f in range(FLOORS)
        for zi in range(UNITS_PER_FLOOR)
    ]
    th = ["Zona"] + ["M{}".format(w + 1) for w in range(weeks)]
    md = "| " + " | ".join(th) + " |\n| " + " | ".join(["---"] * len(th)) + " |\n"
    for z in range(TOTAL_UNITS):
        row = [zone_names[z]] + [c if c else " " for c in work[z]]
        md += "| " + " | ".join(str(c) for c in row) + " |\n"
    st.markdown(md)


def main() -> None:
    init_session()
    hero()

    st.markdown(
        """
<div class="panel rules">
  <h2>Aturan Aliran Kerja</h2>
  <div class="sub">Baca manual dulu sebelum menjalankan simulasi.</div>
  <p><strong>1. Siapa memulai.</strong> Wagon depan adalah <strong>Struktur</strong>. Urutan: Struktur → Pelat → Dinding → MEP → Plester → Keramik → Cat.</p>
  <p><strong>2. Satu zona, satu tim.</strong> Zona: <strong>{z}</strong>. Tidak boleh dua tim di zona yang sama.</p>
  <p><strong>3. Alur zona.</strong> U1 → U2 → Tangga → U3 → U4, lalu naik lantai.</p>
  <p><strong>4. Curing beton ({c} hari)</strong> setelah Pelat selesai di zona itu.</p>
  <p><strong>5. Start Kerja.</strong> Minggu 1–7 = push (dibayar meski menunggu). JIT = masuk tepat waktu.</p>
</div>
""".format(z=" · ".join(ZONE_LABELS), c=CURING_DAYS),
        unsafe_allow_html=True,
    )

    with st.expander("📖 Baca manual lengkap", expanded=False):
        st.markdown(
            """
- Push vs JIT, variasi kapasitas, waste (menunggu tetap dibayar).
- Penalti = hari terlambat × (1/1000) × kontrak.
- Margin = kontrak − biaya tenaga − penalti.
- **1 minggu = {} hari**.
            """.format(DAYS_PER_WEEK)
        )

    st.markdown(
        """
<div class="panel">
  <h2>Setup tim kerja</h2>
  <div class="sub">Start Kerja · variasi kapasitas · owner & kontrak · kecepatan animasi</div>
</div>
""",
        unsafe_allow_html=True,
    )

    cfg, seed, delay = collect_setup()

    b1, b2, b3, b4 = st.columns(4)
    start_clicked = b1.button("▶ Start", type="primary", use_container_width=True)
    pause_clicked = b2.button("⏸ Jeda", use_container_width=True)
    step_clicked = b3.button("1 hari ›", use_container_width=True)
    finish_clicked = b4.button("⏭ Selesaikan", use_container_width=True)

    if start_clicked:
        st.session_state.config = cfg
        st.session_state.rng = create_rng(seed)
        st.session_state.sim_state = create_initial_state(cfg)
        st.session_state.running = True
        st.rerun()

    if pause_clicked:
        st.session_state.running = False

    if step_clicked:
        if st.session_state.sim_state is None:
            st.session_state.config = cfg
            st.session_state.rng = create_rng(seed)
            st.session_state.sim_state = create_initial_state(cfg)
        if not st.session_state.sim_state.finished:
            st.session_state.sim_state = step_day(
                st.session_state.sim_state, st.session_state.rng
            )
        st.session_state.running = False

    if finish_clicked:
        if st.session_state.sim_state is None:
            st.session_state.config = cfg
            st.session_state.rng = create_rng(seed)
            st.session_state.sim_state = create_initial_state(cfg)
        # run rest without delay in loop below via flag
        st.session_state.running = True
        st.session_state["_turbo"] = True
        st.rerun()

    state = st.session_state.sim_state
    if state is None:
        st.info("Atur setup, lalu klik **Start** untuk animasi hari-per-hari.")
        # empty building preview
        empty = create_initial_state(cfg)
        st.markdown(render_building_html(empty), unsafe_allow_html=True)
        return

    # Live area
    st.markdown("### Ilustrasi rusun (animasi)")
    bld_ph = st.empty()
    met_ph = st.empty()

    with met_ph.container():
        render_live_metrics(state)
    bld_ph.markdown(render_building_html(state), unsafe_allow_html=True)

    # Animation step
    turbo = st.session_state.pop("_turbo", False)
    if st.session_state.running and not state.finished:
        if turbo or delay <= 0:
            # run many steps quickly, update every few days for feedback
            steps = 0
            while not st.session_state.sim_state.finished and steps < (500 if turbo else 1):
                st.session_state.sim_state = step_day(
                    st.session_state.sim_state, st.session_state.rng
                )
                steps += 1
                if not turbo and delay > 0:
                    break
            state = st.session_state.sim_state
            bld_ph.markdown(render_building_html(state), unsafe_allow_html=True)
            with met_ph.container():
                render_live_metrics(state)
            if st.session_state.sim_state.finished:
                st.session_state.running = False
            elif turbo:
                st.session_state.running = False
            else:
                time.sleep(delay)
                st.rerun()
        else:
            st.session_state.sim_state = step_day(
                st.session_state.sim_state, st.session_state.rng
            )
            time.sleep(delay)
            st.rerun()

    state = st.session_state.sim_state
    if state.finished:
        st.success(
            "Proyek selesai hari **{}** (minggu ke-{})".format(
                state.metrics.finish_day, day_to_week(state.metrics.finish_day or 0)
            )
        )
        render_results(state)
        with st.expander("Log"):
            for line in reversed(state.log[-30:]):
                st.text(line)
    elif state.day > 0:
        st.caption(
            "Berjalan… Minggu {} · hari {}. Pakai **Jeda** / **1 hari** / **Selesaikan**.".format(
                day_to_week(state.day), state.day
            )
        )

    st.caption("Rusun Takt · github.com/m46d45/rusun-takt")


try:
    main()
except Exception:
    st.error("Terjadi error saat menjalankan app:")
    st.code(traceback.format_exc())
