# -*- coding: utf-8 -*-
"""Rusun Takt — Streamlit mendekati sandbox: metrik, kontrak, wagon berwarna, animasi."""
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
    "Instan": 0.0,
}

st.markdown(
    """
<style>
  [data-testid="stSidebar"],
  [data-testid="stSidebarCollapsedControl"],
  section[data-testid="stSidebar"] { display: none !important; }

  .stApp {
    background: linear-gradient(165deg, #e0f2fe 0%, #f0f9ff 45%, #fff7ed 100%);
  }
  .block-container {
    padding-top: .75rem; padding-bottom: 1.5rem; max-width: 1100px;
  }
  /* perkecil font default streamlit */
  html, body, [class*="css"] { font-size: 14px !important; }
  h1 { font-size: 1.45rem !important; }
  h2, h3 { font-size: 1.05rem !important; margin: .4rem 0 !important; }
  [data-testid="stMetricValue"] {
    font-size: 0.95rem !important;
    font-variant-numeric: tabular-nums !important;
    white-space: nowrap !important;
  }
  [data-testid="stMetricLabel"] { font-size: 0.7rem !important; }
  [data-testid="stMetricDelta"] { font-size: 0.7rem !important; }

  .hero {
    display: flex; align-items: center; gap: .85rem;
    background: #fff; border: 2px solid #7dd3fc; border-radius: 14px;
    padding: .75rem 1rem; margin-bottom: .65rem;
  }
  .hero img {
    width: 64px; height: 64px; border-radius: 12px; object-fit: cover;
    border: 2px solid #fde68a; flex-shrink: 0;
  }
  .hero h1 { margin: 0; font-size: 1.4rem !important; color: #0c4a6e; font-weight: 800; }
  .hero p { margin: .2rem 0 0; color: #475569; font-size: .82rem; line-height: 1.35; }
  .badge-row { margin-top: .35rem; display: flex; flex-wrap: wrap; gap: .3rem; }
  .badge {
    display: inline-block; border-radius: 999px; padding: .1rem .45rem;
    font-size: .68rem; font-weight: 600; border: 1px solid #fcd34d;
    background: #fef3c7; color: #92400e;
  }
  .badge.blue { background: #e0f2fe; color: #075985; border-color: #7dd3fc; }
  .badge.green { background: #dcfce7; color: #166534; border-color: #86efac; }

  .panel {
    background: #fff; border: 1px solid #bae6fd; border-radius: 12px;
    padding: .75rem .9rem; margin-bottom: .65rem;
  }
  .panel h2 {
    margin: 0 0 .1rem !important; font-size: 1rem !important;
    color: #0c4a6e; font-weight: 700;
  }
  .panel .sub { color: #64748b; font-size: .72rem; margin-bottom: .5rem; }
  .rules p { color: #475569; font-size: .78rem; line-height: 1.4; margin: .28rem 0; }
  .rules strong { color: #0f172a; }

  /* finance cards */
  .fin-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .fin-card {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 8px 10px;
  }
  .fin-card .lbl {
    font-size: .65rem; text-transform: uppercase; letter-spacing: .04em;
    color: #64748b; font-weight: 600;
  }
  .fin-card .val {
    font-size: .88rem; font-weight: 700; color: #0f172a;
    font-variant-numeric: tabular-nums; margin-top: 2px;
    word-break: break-word;
  }
  .fin-card .val.sm { font-size: .78rem; }
  .fin-card .val.danger { color: #dc2626; }
  .fin-card .val.ok { color: #16a34a; }
  .fin-card.live { border-color: #7dd3fc; background: #f0f9ff; }

  /* team wagon cards */
  .wagon {
    display: flex; align-items: center; gap: 8px;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 7px 9px; margin-bottom: 6px;
  }
  .wagon.hot { border-color: #f97316; background: #ffedd5; box-shadow: 0 0 0 2px #fdba74; }
  .wagon .helm {
    width: 30px; height: 30px; border-radius: 50% 50% 42% 42%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 800; font-size: 12px; flex-shrink: 0;
    border: 2px solid rgba(255,255,255,.8); box-shadow: 0 1px 4px rgba(0,0,0,.2);
  }
  .wagon .meta { flex: 1; min-width: 0; }
  .wagon .name { font-size: .8rem; font-weight: 700; color: #0f172a; }
  .wagon .sub { font-size: .68rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wagon .bar {
    height: 5px; background: #e2e8f0; border-radius: 99px; margin-top: 4px; overflow: hidden;
  }
  .wagon .bar > i {
    display: block; height: 100%; border-radius: 99px;
  }
  .wagon .nums {
    text-align: right; font-size: .68rem; font-variant-numeric: tabular-nums;
    color: #334155; line-height: 1.25; flex-shrink: 0;
  }
  .wagon .nums .w { color: #dc2626; font-weight: 700; }

  /* building */
  .bld { border: 2px solid #6b7280; border-radius: 10px 10px 0 0; overflow: hidden; background: #f1f5f9; }
  .floor {
    display: grid; grid-template-columns: 1fr 1fr 0.55fr 1fr 1fr;
    border-bottom: 2px solid #94a3b8; min-height: 64px;
  }
  .floor:last-child { border-bottom: none; }
  .cell {
    position: relative; border-right: 1px solid #cbd5e1; background: #f8fafc;
    min-height: 64px; display: flex; align-items: center; justify-content: center;
  }
  .cell:last-child { border-right: none; }
  .cell.stair { background: #e2e8f0; }
  .cell .zl { position: absolute; top: 3px; left: 4px; font-size: 8px; color: #64748b; font-weight: 600; }
  .cell .fl {
    position: absolute; top: 3px; right: 4px; font-size: 8px; color: #334155; font-weight: 700;
    background: #fff; border-radius: 3px; padding: 0 3px;
  }
  .helm-b {
    width: 30px; height: 30px; border-radius: 50% 50% 42% 42%;
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 800; font-size: 12px;
    box-shadow: 0 2px 6px rgba(0,0,0,.22); border: 2px solid rgba(255,255,255,.75);
  }
  .helm-b.work { box-shadow: 0 0 0 3px #38bdf8, 0 2px 6px rgba(0,0,0,.2); transform: scale(1.08); }
  .helm-b.wait { box-shadow: 0 0 0 3px #f87171, 0 2px 6px rgba(0,0,0,.2); }
  .cell.done { background: #dcfce7 !important; }
  .cell.done::after {
    content: "✓"; position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center; color: #16a34a;
    font-size: 18px; font-weight: 800; opacity: .9;
  }
  .fond {
    background: #4b5563; color: #f1f5f9; text-align: center;
    padding: 6px; border-radius: 0 0 10px 10px; font-size: 10px;
    text-transform: uppercase; letter-spacing: .04em; font-weight: 600;
  }

  .tiny { font-size: .72rem; color: #64748b; }
  table.rt { width: 100%; border-collapse: collapse; font-size: .72rem; }
  table.rt th {
    background: #0c4a6e; color: #e0f2fe; padding: 5px 6px; text-align: left;
    font-weight: 600; font-size: .65rem; text-transform: uppercase;
  }
  table.rt td {
    padding: 5px 6px; border-bottom: 1px solid #e2e8f0;
    font-variant-numeric: tabular-nums; color: #0f172a;
  }
  table.rt tr:nth-child(even) td { background: #f8fafc; }
  table.rt .danger { color: #dc2626; font-weight: 700; }
  table.rt .tot td { background: #0c4a6e !important; color: #e0f2fe; font-weight: 700; }
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
    return "JIT" if int(sw) == START_JIT else "M{}".format(int(sw) + 1)


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
    <p>Simulasi parade tim kerja dan metodologi Takt — push, capacity building, flow.</p>
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
                    '<div class="helm-b {cls}" style="background:{c}" title="{title}">{n}</div>'
                ).format(
                    cls=cls,
                    c=TEAMS[i]["color"],
                    n=i + 1,
                    title="{} · {}".format(TEAMS[i]["short"], t.status_label),
                )
            if done:
                cell_cls = "cell done" + (" stair" if is_stair else "")
                bg = ""
            else:
                cell_cls = "cell stair" if is_stair else "cell"
                highest = -1
                for ti, t in enumerate(state.teams):
                    if t.progress > z:
                        highest = ti
                bg = (
                    "background:{}33;".format(TEAMS[highest]["color"])
                    if highest >= 0
                    else ""
                )
            fl_label = "Lt.{}".format(f + 1) if zi == 0 else ""
            cells.append(
                '<div class="{cls}" style="{bg}">'
                '<span class="zl">{lab}</span>{fl}{helm}</div>'.format(
                    cls=cell_cls,
                    bg=bg,
                    lab=ZONE_LABELS[zi],
                    fl=(
                        '<span class="fl">{}</span>'.format(fl_label)
                        if fl_label
                        else ""
                    ),
                    helm=helm,
                )
            )
        floors_html.append('<div class="floor">{}</div>'.format("".join(cells)))

    return (
        '<div class="bld">{floors}</div>'
        '<div class="fond">Fondasi & sloof · Hari {day} · Minggu {week}</div>'
    ).format(
        floors="".join(floors_html),
        day=state.day,
        week=day_to_week(state.day) if state.day else 0,
    )


def finance_html(state) -> str:
    fin = compute_finance(
        state.config,
        state.metrics.finish_day or state.day,
        state.metrics.total_cost,
        state.metrics.waste_cost,
        state.finished,
    )
    wait = sum(t.wait_days for t in state.teams)
    waste_pct = (
        (state.metrics.waste_cost / state.metrics.total_cost * 100)
        if state.metrics.total_cost > 0
        else 0
    )
    live = "live" if (not state.finished and state.day > 0) else ""
    late_cls = "danger" if fin["late_days"] > 0 else "ok"
    margin_cls = "danger" if fin["margin"] < 0 else "ok"
    late_txt = (
        "+{}h vs owner".format(fin["late_days"])
        if fin["late_days"] > 0
        else ("Dalam target" if state.day > 0 else "Belum mulai")
    )
    return """
<div class="panel">
  <h2>Metrik</h2>
  <div class="sub">{live_badge}</div>
  <div class="fin-grid">
    <div class="fin-card"><div class="lbl">Durasi aktual</div>
      <div class="val">{dur}</div></div>
    <div class="fin-card"><div class="lbl">Durasi owner</div>
      <div class="val">{owner} hari</div></div>
    <div class="fin-card"><div class="lbl">Biaya tenaga</div>
      <div class="val sm">{labor}</div></div>
    <div class="fin-card"><div class="lbl">Waste (menunggu)</div>
      <div class="val sm {wcls}">{waste}</div></div>
    <div class="fin-card"><div class="lbl">Waste % biaya</div>
      <div class="val {wcls}">{wpct}</div></div>
    <div class="fin-card"><div class="lbl">Hari menunggu</div>
      <div class="val">{wait}</div></div>
  </div>
</div>
<div class="panel">
  <h2>Kontrak & margin</h2>
  <div class="fin-grid">
    <div class="fin-card {live}"><div class="lbl">Nilai kontrak</div>
      <div class="val sm">{kontrak}</div></div>
    <div class="fin-card"><div class="lbl">Ketepatan waktu</div>
      <div class="val sm {late_cls}">{late}</div></div>
    <div class="fin-card"><div class="lbl">Penalti</div>
      <div class="val sm {late_cls}">{pen}</div></div>
    <div class="fin-card {live}"><div class="lbl">Margin</div>
      <div class="val sm {margin_cls}">{margin}<br/><span class="tiny">{mpct}%</span></div></div>
  </div>
  <p class="tiny" style="margin-top:8px">Penalti = terlambat × (1/1000) × kontrak. Margin = kontrak − tenaga − penalti.</p>
</div>
""".format(
        live_badge='<span class="badge blue">live</span>' if live else "",
        dur=(
            "Hari {}".format(state.metrics.finish_day)
            if state.metrics.finish_day
            else ("Hari {}".format(state.day) if state.day else "—")
        ),
        owner=fin["owner_duration_days"],
        labor=fmt_rp(state.metrics.total_cost),
        waste=fmt_rp(state.metrics.waste_cost),
        wcls="danger" if state.metrics.waste_cost > 0 else "",
        wpct="{:.0f}%".format(waste_pct) if state.metrics.total_cost else "—",
        wait=wait,
        live=live,
        kontrak=fmt_rp(fin["contract_value"]),
        late=late_txt,
        late_cls=late_cls,
        pen=fmt_rp(fin["penalty"]),
        margin=fmt_rp(fin["margin"]),
        margin_cls=margin_cls,
        mpct="{:.1f}".format(fin["margin_pct"]),
    )



def wagons_html(state) -> str:
    max_waste = max((t.waste_cost for t in state.teams), default=0)
    parts = [
        '<div class="panel">',
        "<h2>Wagon / tim kerja</h2>",
        '<div class="sub">Helm berwarna · bar progress · ★ waste tertinggi (latar oranye)</div>',
    ]
    for i, t in enumerate(state.teams):
        setup = state.config.teams[i]
        pct = min(100, (t.progress / TOTAL_UNITS) * 100) if TOTAL_UNITS else 0
        team_cost = t.days_on_site * setup.daily_cost
        wp = (t.waste_cost / team_cost * 100) if team_cost > 0 else 0.0
        is_max = max_waste > 0 and t.waste_cost == max_waste and t.waste_cost > 0
        hot_cls = "hot" if is_max else ""
        star = " ★" if is_max else ""
        wcls = "w" if t.waste_cost > 0 else ""
        parts.append(
            '<div class="wagon '
            + hot_cls
            + '">'
            '<div class="helm" style="background:'
            + TEAMS[i]["color"]
            + '">'
            + str(i + 1)
            + "</div>"
            '<div class="meta">'
            '<div class="name">'
            + TEAMS[i]["short"]
            + star
            + "</div>"
            '<div class="sub">'
            + t.status_label
            + " · "
            + start_label(setup.start_week)
            + " · var "
            + str(setup.dice_min)
            + "–"
            + str(setup.dice_max)
            + "</div>"
            '<div class="bar"><i style="width:'
            + str(pct)
            + "%;background:"
            + TEAMS[i]["color"]
            + '"></i></div>'
            "</div>"
            '<div class="nums">'
            + str(t.progress)
            + "/"
            + str(TOTAL_UNITS)
            + " zona<br/>"
            "biaya "
            + fmt_rp(team_cost)
            + "<br/>"
            '<span class="'
            + wcls
            + '">waste '
            + fmt_rp(t.waste_cost)
            + (" ({:.0f}%)".format(wp) if t.waste_cost else "")
            + "</span>"
            "</div></div>"
        )
    parts.append("</div>")
    return "".join(parts)


def results_rows(state):
    """Plain data for hasil per tim."""
    body = []
    total_cap = total_unused = total_waste = 0
    max_waste = max((t.waste_cost for t in state.teams), default=0)
    total_labor = state.metrics.total_cost or 0
    for i, t in enumerate(state.teams):
        durs = t.zone_durations or [0]
        total_cap += t.capacity_total
        total_unused += t.unused_capacity
        total_waste += t.waste_cost
        team_cost = t.days_on_site * state.config.teams[i].daily_cost
        wp = (t.waste_cost / team_cost * 100) if team_cost > 0 else 0.0
        is_max = max_waste > 0 and t.waste_cost == max_waste and t.waste_cost > 0
        body.append(
            {
                "i": i,
                "name": TEAMS[i]["short"],
                "color": TEAMS[i]["color"],
                "start": start_label(state.config.teams[i].start_week),
                "var": "{}–{}".format(
                    state.config.teams[i].dice_min, state.config.teams[i].dice_max
                ),
                "wk": day_to_week(t.finish_day) if t.finish_day else "—",
                "cap": t.capacity_total,
                "un": t.unused_capacity,
                "mx": max(durs) if durs else 0,
                "mn": min(durs) if durs else 0,
                "avg": round(sum(durs) / len(durs), 1) if durs else 0,
                "waste": t.waste_cost,
                "waste_pct": wp,
                "is_max_waste": is_max,
            }
        )
    total = {
        "cap": total_cap,
        "un": total_unused,
        "waste": total_waste,
        "waste_pct": (total_waste / total_labor * 100) if total_labor else 0.0,
    }
    return body, total


def render_results_table(state) -> None:
    body, total = results_rows(state)
    parts = [
        '<div class="panel">',
        "<h2>Hasil per tim</h2>",
        '<div class="sub">★ = waste tertinggi (disorot merah muda)</div>',
        '<div style="overflow-x:auto">',
        '<table class="rt">',
        "<thead><tr>",
        "<th>Tim</th><th>Start</th><th>Var</th><th>Mg selesai</th>",
        "<th>Hari kerja</th><th>Tak terpakai</th><th>Maks</th><th>Min</th>",
        "<th>Rata</th><th>Waste</th><th>Waste %</th>",
        "</tr></thead><tbody>",
    ]
    for r in body:
        mark = " ★" if r["is_max_waste"] else ""
        bg = "background:#fee2e2;" if r["is_max_waste"] else ""
        dcls = "danger" if r["waste"] > 0 else ""
        parts.append(
            '<tr style="' + bg + '">'
            '<td><span style="display:inline-block;width:18px;height:18px;border-radius:50%;'
            "background:" + r["color"] + ";color:#fff;font-size:10px;font-weight:800;"
            'text-align:center;line-height:18px;margin-right:4px">'
            + str(r["i"] + 1)
            + "</span>"
            + r["name"]
            + mark
            + "</td>"
            "<td>" + r["start"] + "</td>"
            "<td>" + r["var"] + "</td>"
            "<td>" + str(r["wk"]) + "</td>"
            "<td>" + str(r["cap"]) + "</td>"
            '<td class="' + dcls + '">' + (str(r["un"]) if r["un"] else "—") + "</td>"
            "<td>" + (str(r["mx"]) if r["mx"] else "—") + "</td>"
            "<td>" + (str(r["mn"]) if r["mn"] else "—") + "</td>"
            "<td>" + (str(r["avg"]) if r["avg"] else "—") + "</td>"
            '<td class="' + dcls + '">'
            + (fmt_rp(r["waste"]) if r["waste"] else "—")
            + "</td>"
            '<td class="' + dcls + '">'
            + ("{:.0f}%".format(r["waste_pct"]) if r["waste"] else "—")
            + "</td>"
            "</tr>"
        )
    parts.append(
        '<tr class="tot"><td>TOTAL</td><td></td><td></td><td></td>'
        "<td>" + str(total["cap"]) + "</td>"
        "<td>" + str(total["un"]) + "</td>"
        "<td></td><td></td><td></td>"
        "<td>" + fmt_rp(total["waste"]) + "</td>"
        "<td>" + "{:.0f}%".format(total["waste_pct"]) + "</td>"
        "</tr></tbody></table></div></div>"
    )
    st.markdown("".join(parts), unsafe_allow_html=True)


def takt_table_html(state) -> str:
    weeks, work = build_takt_grid(state.history)
    zone_names = [
        "{}.{}".format(f + 1, ZONE_LABELS[zi])
        for f in range(FLOORS)
        for zi in range(UNITS_PER_FLOOR)
    ]
    # color map short -> color
    color = {t["short"]: t["color"] for t in TEAMS}
    head = "".join(
        "<th>M{}</th>".format(w + 1) for w in range(weeks)
    )
    body = []
    for z in range(TOTAL_UNITS):
        cells = []
        for w in range(weeks):
            name = work[z][w]
            if name:
                cells.append(
                    '<td style="background:{c};color:#fff;font-weight:700;text-align:center">{s}</td>'.format(
                        c=color.get(name, "#64748b"),
                        s=name[:3],
                    )
                )
            else:
                cells.append('<td style="background:#fff"></td>')
        body.append(
            "<tr><td><b>{}</b></td>{}</tr>".format(zone_names[z], "".join(cells))
        )
    legend = " · ".join(
        '<span style="color:{c};font-weight:700">{n}. {s}</span>'.format(
            c=t["color"], n=i + 1, s=t["short"]
        )
        for i, t in enumerate(TEAMS)
    )
    return """
<div class="panel">
  <h2>Takt plan — timeline minggu</h2>
  <div class="sub">1 minggu = {d} hari · sel berwarna = tim bekerja · putih = idle/curing</div>
  <div style="overflow-x:auto">
  <table class="rt">
    <thead><tr><th>Zona</th>{head}</tr></thead>
    <tbody>{body}</tbody>
  </table>
  </div>
  <p class="tiny" style="margin-top:8px">{legend}</p>
</div>
""".format(
        d=DAYS_PER_WEEK,
        head=head,
        body="".join(body),
        legend=legend,
    )


def init_session() -> None:
    for k, v in (
        ("sim_state", None),
        ("running", False),
        ("rng", None),
        ("config", None),
    ):
        if k not in st.session_state:
            st.session_state[k] = v


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
        "Penalti = terlambat × (1/1000) × kontrak · Margin = kontrak − tenaga − penalti · "
        "Default kontrak 210 jt"
    )

    p1, p2 = st.columns([2, 1.2])
    with p1:
        preset = st.radio(
            "Preset",
            ["Push · M1 · 1–6", "JIT · 7–7"],
            horizontal=True,
            index=0,
        )
    with p2:
        speed_label = st.select_slider(
            "Kecepatan",
            options=list(SPEED_MS.keys()),
            value="Normal · 0,5 dtk",
        )

    if preset.startswith("JIT"):
        default_sw, default_lo, default_hi = START_JIT, 7, 7
    else:
        default_sw, default_lo, default_hi = 0, 1, 6

    start_options = list(range(7)) + [START_JIT]

    def fmt_start(x: int) -> str:
        return "JIT" if x == START_JIT else "Minggu {}".format(x + 1)

    team_rows = []
    # Header sejajar dengan baris data (rasio kolom sama)
    col_ratios = [1.5, 1.3, 0.7, 0.7, 0.9]
    h1, h2, h3, h4, h5 = st.columns(col_ratios)
    h1.markdown(
        '<p style="margin:0;font-size:.65rem;font-weight:700;color:#64748b;'
        'text-transform:uppercase;letter-spacing:.03em">Tim kerja</p>',
        unsafe_allow_html=True,
    )
    h2.markdown(
        '<p style="margin:0;font-size:.65rem;font-weight:700;color:#64748b;'
        'text-transform:uppercase;letter-spacing:.03em">Start kerja</p>',
        unsafe_allow_html=True,
    )
    h3.markdown(
        '<p style="margin:0;font-size:.65rem;font-weight:700;color:#64748b;'
        'text-transform:uppercase;letter-spacing:.03em">Bawah</p>',
        unsafe_allow_html=True,
    )
    h4.markdown(
        '<p style="margin:0;font-size:.65rem;font-weight:700;color:#64748b;'
        'text-transform:uppercase;letter-spacing:.03em">Atas</p>',
        unsafe_allow_html=True,
    )
    h5.markdown(
        '<p style="margin:0;font-size:.65rem;font-weight:700;color:#64748b;'
        'text-transform:uppercase;letter-spacing:.03em">Biaya/hari'
        '<br/><span style="font-weight:500;text-transform:none">'
        '(× Rp1.000)</span></p>',
        unsafe_allow_html=True,
    )
    for i, defn in enumerate(TEAMS):
        a, b, c, d, e = st.columns(col_ratios)
        with a:
            st.markdown(
                '<span style="display:inline-flex;width:22px;height:22px;border-radius:50%;'
                "background:{c};color:#fff;font-size:11px;font-weight:800;align-items:center;"
                'justify-content:center;margin-right:6px">{n}</span>'
                '<b style="font-size:.85rem">{name}</b>'.format(
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


def main() -> None:
    init_session()
    hero()

    st.markdown(
        """
<div class="panel rules">
  <h2>Aturan Aliran Kerja</h2>
  <div class="sub">Baca manual sebelum Start.</div>
  <p><strong>1. Siapa memulai.</strong> Wagon depan <strong>Struktur</strong> → Pelat → Dinding → MEP → Plester → Keramik → Cat.</p>
  <p><strong>2. Satu zona, satu tim.</strong> {z}. Tidak boleh dua tim bersamaan.</p>
  <p><strong>3. Alur zona.</strong> U1 → U2 → Tangga → U3 → U4, naik lantai.</p>
  <p><strong>4. Curing {c} hari</strong> setelah Pelat selesai per zona.</p>
  <p><strong>5. Start Kerja.</strong> Minggu 1–7 = push. JIT = masuk tepat waktu.</p>
</div>
""".format(z=" · ".join(ZONE_LABELS), c=CURING_DAYS),
        unsafe_allow_html=True,
    )

    with st.expander("📖 Manual", expanded=False):
        st.markdown(
            "- Push vs JIT · variasi kapasitas · waste tetap dibayar\n"
            "- Penalti = terlambat × 1/1000 × kontrak\n"
            "- Margin = kontrak − tenaga − penalti\n"
            "- **1 minggu = {} hari**".format(DAYS_PER_WEEK)
        )

    st.markdown(
        '<div class="panel"><h2>Setup tim kerja</h2>'
        '<div class="sub">Start · variasi · biaya · owner & kontrak</div></div>',
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
        st.session_state.running = True
        st.session_state["_turbo"] = True
        st.rerun()

    state = st.session_state.sim_state
    if state is None:
        st.info("Klik **Start** untuk animasi hari-per-hari.")
        empty = create_initial_state(cfg)
        col_b, col_m = st.columns([1.4, 1])
        with col_b:
            st.markdown("##### Ilustrasi rusun")
            st.markdown(render_building_html(empty), unsafe_allow_html=True)
        with col_m:
            st.markdown(finance_html(empty), unsafe_allow_html=True)
        st.markdown(wagons_html(empty), unsafe_allow_html=True)
        return

    # Layout: kiri = ilustrasi, kanan = metrik/kontrak; wagon di BAWAH ilustrasi (full width)
    col_b, col_m = st.columns([1.4, 1])
    with col_b:
        st.markdown("##### Ilustrasi rusun")
        bld = st.empty()
        bld.markdown(render_building_html(state), unsafe_allow_html=True)
    with col_m:
        fin_ph = st.empty()
        fin_ph.markdown(finance_html(state), unsafe_allow_html=True)
    wag_ph = st.empty()
    wag_ph.markdown(wagons_html(state), unsafe_allow_html=True)

    turbo = st.session_state.pop("_turbo", False)
    if st.session_state.running and not state.finished:
        if turbo or delay <= 0:
            steps = 0
            while (
                not st.session_state.sim_state.finished
                and steps < (800 if turbo else 1)
            ):
                st.session_state.sim_state = step_day(
                    st.session_state.sim_state, st.session_state.rng
                )
                steps += 1
            state = st.session_state.sim_state
            bld.markdown(render_building_html(state), unsafe_allow_html=True)
            fin_ph.markdown(finance_html(state), unsafe_allow_html=True)
            wag_ph.markdown(wagons_html(state), unsafe_allow_html=True)
            st.session_state.running = False if (
                state.finished or turbo
            ) else st.session_state.running
            if not state.finished and not turbo and delay > 0:
                time.sleep(delay)
                st.rerun()
            elif not state.finished and delay <= 0 and not turbo:
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
            "Selesai hari **{}** (minggu ke-{})".format(
                state.metrics.finish_day,
                day_to_week(state.metrics.finish_day or 0),
            )
        )
        render_results_table(state)
        st.markdown(takt_table_html(state), unsafe_allow_html=True)
        with st.expander("Log"):
            for line in reversed(state.log[-30:]):
                st.text(line)
    elif state.day > 0:
        st.caption(
            "Berjalan · Minggu {} · hari {} · Jeda / 1 hari / Selesaikan".format(
                day_to_week(state.day), state.day
            )
        )

    st.caption(
        "Rusun Takt · Streamlit ≈ sandbox · animasi terhalus di web preview · "
        "github.com/m46d45/rusun-takt"
    )


try:
    main()
except Exception:
    st.error("Terjadi error:")
    st.code(traceback.format_exc())
