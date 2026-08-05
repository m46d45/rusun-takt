"""Rusun Takt — engine simulasi (Python, port dari TypeScript)."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Callable, List, Optional

FLOORS = 3
ZONES_PER_FLOOR = 5
ZONE_LABELS = ["U1", "U2", "Tangga", "U3", "U4"]
UNITS_PER_FLOOR = ZONES_PER_FLOOR
TOTAL_UNITS = FLOORS * ZONES_PER_FLOOR
CURING_DAYS = 7
DAYS_PER_WEEK = 7
DEFAULT_DAILY_COST = 350_000
START_JIT = -1
CAP_MIN = 1
CAP_MAX = 9
DEFAULT_OWNER_DURATION = 120
DEFAULT_CONTRACT_VALUE = 210_000_000
PENALTY_PER_DAY_FRACTION = 1 / 1000

TEAMS = [
    {"id": 0, "name": "Kolom & balok", "short": "Struktur", "color": "#6b7280"},
    {"id": 1, "name": "Pelat & tangga", "short": "Pelat", "color": "#eab308"},
    {"id": 2, "name": "Dinding & pasangan", "short": "Dinding", "color": "#dc2626"},
    {"id": 3, "name": "MEP", "short": "MEP", "color": "#16a34a"},
    {"id": 4, "name": "Plester & acian", "short": "Plester", "color": "#9333ea"},
    {"id": 5, "name": "Keramik & plafon", "short": "Keramik", "color": "#ea580c"},
    {"id": 6, "name": "Pengecatan", "short": "Cat", "color": "#38bdf8"},
]


def clamp_cap(n: int) -> int:
    return max(CAP_MIN, min(CAP_MAX, int(round(n))))


def zone_label(z: int) -> str:
    f = z // UNITS_PER_FLOOR
    zi = z % UNITS_PER_FLOOR
    return f"{f + 1}.{ZONE_LABELS[zi]}"


def week_to_start_day(start_week: int) -> int:
    return start_week * DAYS_PER_WEEK + 1


def day_to_week(day: int) -> int:
    if day <= 0:
        return 0
    return (day + DAYS_PER_WEEK - 1) // DAYS_PER_WEEK


def is_jit(start_week: int) -> bool:
    return start_week == START_JIT


def create_rng(seed: int) -> Callable[[], float]:
    t = seed & 0xFFFFFFFF

    def rng() -> float:
        nonlocal t
        t = (t + 0x6D2B79F5) & 0xFFFFFFFF
        r = (t ^ (t >> 15)) * (1 | t)
        r &= 0xFFFFFFFF
        r ^= r + ((r ^ (r >> 7)) * (61 | r))
        r &= 0xFFFFFFFF
        return ((r ^ (r >> 14)) & 0xFFFFFFFF) / 4294967296.0

    return rng


def roll_dice(rng: Callable[[], float], lo: int, hi: int) -> int:
    if lo >= hi:
        return lo
    return lo + int(rng() * (hi - lo + 1))


@dataclass
class TeamSetup:
    start_week: int = 0
    dice_min: int = 1
    dice_max: int = 6
    daily_cost: int = DEFAULT_DAILY_COST


@dataclass
class SimConfig:
    teams: List[TeamSetup] = field(default_factory=list)
    owner_duration_days: int = DEFAULT_OWNER_DURATION
    contract_value: int = DEFAULT_CONTRACT_VALUE
    name: Optional[str] = None


@dataclass
class TeamState:
    progress: int = 0
    last_roll: int = 0
    last_worked: int = 0
    status: str = "waiting"
    status_label: str = "Belum start"
    total_worked: int = 0
    wait_days: int = 0
    waste_cost: int = 0
    days_on_site: int = 0
    capacity_total: int = 0
    unused_capacity: int = 0
    finish_day: Optional[int] = None
    zone_days_left: int = 0
    zone_days_total: int = 0
    mobilized: bool = False
    zone_durations: List[int] = field(default_factory=list)


@dataclass
class ZoneCure:
    poured_day: Optional[int] = None
    ready_day: Optional[int] = None
    stripped: bool = False


@dataclass
class DayHistTeam:
    roll: int = 0
    worked: int = 0
    unused: int = 0
    on_site: bool = False
    zones_completed: List[int] = field(default_factory=list)
    waiting_zone: Optional[int] = None
    active_zone: Optional[int] = None


@dataclass
class DayHistory:
    day: int
    teams: List[DayHistTeam]


@dataclass
class Metrics:
    day: int = 0
    total_labor_days: int = 0
    total_cost: int = 0
    waste_cost: int = 0
    wait_days: int = 0
    finished: bool = False
    finish_day: Optional[int] = None


@dataclass
class SimSnapshot:
    day: int
    teams: List[TeamState]
    zone_cures: List[ZoneCure]
    metrics: Metrics
    log: List[str]
    finished: bool
    config: SimConfig
    history: List[DayHistory]


def default_config(lo: int = 1, hi: int = 6, jit: bool = False) -> SimConfig:
    sw = START_JIT if jit else 0
    return SimConfig(
        teams=[
            TeamSetup(start_week=sw, dice_min=lo, dice_max=hi) for _ in TEAMS
        ]
    )


def normalize_config(cfg: Optional[SimConfig] = None) -> SimConfig:
    base = cfg or default_config()
    teams: List[TeamSetup] = []
    for i in range(len(TEAMS)):
        t = base.teams[i] if i < len(base.teams) else TeamSetup()
        sw = int(t.start_week)
        if sw != START_JIT:
            sw = max(0, min(6, sw))
        lo = clamp_cap(t.dice_min)
        hi = clamp_cap(t.dice_max)
        if lo > hi:
            lo, hi = hi, lo
        teams.append(
            TeamSetup(
                start_week=sw,
                dice_min=lo,
                dice_max=hi,
                daily_cost=max(0, int(round(t.daily_cost))),
            )
        )
    return SimConfig(
        teams=teams,
        owner_duration_days=max(1, int(round(base.owner_duration_days))),
        contract_value=max(0, int(round(base.contract_value))),
        name=base.name,
    )


def compute_finance(cfg: SimConfig, day: int, labor: int, waste: int, finished: bool = False):
    c = normalize_config(cfg)
    day = max(0, day)
    late = max(0, day - c.owner_duration_days)
    penalty = late * PENALTY_PER_DAY_FRACTION * c.contract_value
    margin = c.contract_value - labor - penalty
    pct = (margin / c.contract_value * 100) if c.contract_value > 0 else 0.0
    return {
        "owner_duration_days": c.owner_duration_days,
        "contract_value": c.contract_value,
        "finish_day": day,
        "late_days": late,
        "penalty": penalty,
        "labor_cost": labor,
        "waste_cost": waste,
        "margin": margin,
        "margin_pct": pct,
        "on_time": (late == 0 and day > 0) if finished else day <= c.owner_duration_days,
    }


def create_initial_state(config: Optional[SimConfig] = None) -> SimSnapshot:
    cfg = normalize_config(config)
    return SimSnapshot(
        day=0,
        teams=[TeamState() for _ in TEAMS],
        zone_cures=[ZoneCure() for _ in range(TOTAL_UNITS)],
        metrics=Metrics(),
        log=[],
        finished=False,
        config=cfg,
        history=[],
    )


def zone_ready(zc: ZoneCure, day: int) -> bool:
    return zc.ready_day is not None and day > zc.ready_day


def can_access_zone(
    team_id: int,
    start_progress: List[int],
    my_progress: int,
    zone_cures: List[ZoneCure],
    day: int,
):
    if my_progress >= TOTAL_UNITS:
        return False, None
    next_zone = my_progress
    next_floor = next_zone // UNITS_PER_FLOOR
    zone_on_floor = next_zone % UNITS_PER_FLOOR
    zone_name = ZONE_LABELS[zone_on_floor]

    if team_id > 0:
        prev = start_progress[team_id - 1]
        if prev <= next_zone:
            return False, f"Tunggu {TEAMS[team_id - 1]['short']} lepas {zone_name}"

    if team_id >= 2:
        zc = zone_cures[next_zone]
        if not zone_ready(zc, day):
            if zc.poured_day is None:
                return False, f"Tunggu pelat {zone_label(next_zone)}"
            remain = max(0, (zc.ready_day or day) + 1 - day)
            return False, f"Curing {zone_label(next_zone)} · {remain}h"

    if team_id == 0 and next_floor > 0:
        below = next_zone - UNITS_PER_FLOOR
        zc = zone_cures[below]
        if not zone_ready(zc, day):
            if zc.poured_day is None:
                return False, f"Tunggu pelat {zone_label(below)}"
            remain = max(0, (zc.ready_day or day) + 1 - day)
            return False, f"Curing {zone_label(below)} · {remain}h"

    return True, None


def mark_pelat(zone_cures: List[ZoneCure], zone_index: int, day: int, log: List[str]):
    zc = zone_cures[zone_index]
    if zc.poured_day is not None:
        return
    zc.poured_day = day
    zc.ready_day = day + CURING_DAYS
    log.append(
        f"H{day}: Pelat {zone_label(zone_index)} dicor · curing H{day + 1}–H{zc.ready_day} · siap H{zc.ready_day + 1}"
    )


def apply_strip(zone_cures: List[ZoneCure], day: int, log: List[str]):
    for z, zc in enumerate(zone_cures):
        if zc.ready_day is not None and day > zc.ready_day and not zc.stripped:
            zc.stripped = True
            log.append(f"H{day}: Bekisting {zone_label(z)} dilepas")


def should_be_on_site(setup: TeamSetup, team: TeamState, day: int, access_ok: bool):
    if team.progress >= TOTAL_UNITS:
        return False, "Selesai"
    if is_jit(setup.start_week):
        if team.mobilized:
            return True, ""
        if access_ok:
            return True, ""
        return False, "JIT · menunggu zona"
    earliest = week_to_start_day(setup.start_week)
    if day < earliest:
        return False, f"Start M{setup.start_week + 1}"
    return True, ""


def step_day(state: SimSnapshot, rng: Callable[[], float]) -> SimSnapshot:
    if state.finished:
        return state

    config = normalize_config(state.config)
    day = state.day + 1
    start_progress = [t.progress for t in state.teams]
    teams = deepcopy(state.teams)
    zone_cures = deepcopy(state.zone_cures)
    log = list(state.log)
    apply_strip(zone_cures, day, log)

    day_cost = day_waste = day_wait = day_labor = 0
    day_hist = DayHistory(
        day=day, teams=[DayHistTeam() for _ in TEAMS]
    )

    for i, t in enumerate(teams):
        setup = config.teams[i]
        hist = day_hist.teams[i]

        if t.progress >= TOTAL_UNITS:
            t.last_roll = 0
            t.last_worked = 0
            t.status = "done"
            t.status_label = "Selesai"
            t.zone_days_left = 0
            t.zone_days_total = 0
            continue

        ok, reason = can_access_zone(i, start_progress, t.progress, zone_cures, day)
        on_site, label = should_be_on_site(setup, t, day, ok)
        if not on_site:
            t.last_roll = 0
            t.last_worked = 0
            t.status = "waiting"
            t.status_label = label
            continue

        if is_jit(setup.start_week) and not t.mobilized and ok:
            t.mobilized = True
            log.append(f"H{day}: {TEAMS[i]['short']} JIT mulai di {zone_label(t.progress)}")
        if not is_jit(setup.start_week) and not t.mobilized:
            t.mobilized = True

        t.days_on_site += 1
        day_labor += 1
        day_cost += setup.daily_cost
        hist.on_site = True

        if not ok:
            t.last_roll = 0
            t.last_worked = 0
            t.wait_days += 1
            t.waste_cost += setup.daily_cost
            t.unused_capacity += 1
            day_waste += setup.daily_cost
            day_wait += 1
            hist.unused = 1
            hist.waiting_zone = t.progress
            low = (reason or "").lower()
            is_cure = "curing" in low or "tunggu pelat" in low
            t.status = "curing" if is_cure else "blocked"
            t.status_label = reason or "Menunggu zona"
            continue

        if t.zone_days_left <= 0:
            days = roll_dice(rng, setup.dice_min, setup.dice_max)
            t.zone_days_left = days
            t.zone_days_total = days
            t.last_roll = days
            t.capacity_total += days
            hist.roll = days
        else:
            t.last_roll = t.zone_days_total
            hist.roll = t.zone_days_total

        hist.active_zone = t.progress
        t.zone_days_left -= 1
        t.last_worked = 1
        t.total_worked += 1
        hist.worked = 1
        t.status = "working"
        done = t.zone_days_total - t.zone_days_left
        t.status_label = f"{zone_label(t.progress)} · {done}/{t.zone_days_total}h"

        if t.zone_days_left <= 0:
            zone_done = t.progress
            dur = t.zone_days_total
            t.progress += 1
            hist.zones_completed.append(zone_done)
            t.zone_durations.append(dur)
            t.zone_days_left = 0
            t.zone_days_total = 0
            if i == 1:
                mark_pelat(zone_cures, zone_done, day, log)
            if t.progress >= TOTAL_UNITS:
                t.status = "done"
                t.status_label = "Selesai"
                t.finish_day = day
                log.append(f"H{day}: {TEAMS[i]['short']} selesai seluruh zona")
            else:
                t.status_label = f"{zone_label(zone_done)} selesai"

    finished = all(t.progress >= TOTAL_UNITS for t in teams)
    if finished:
        log.append(f"H{day}: Proyek selesai")

    return SimSnapshot(
        day=day,
        teams=teams,
        zone_cures=zone_cures,
        metrics=Metrics(
            day=day,
            total_labor_days=state.metrics.total_labor_days + day_labor,
            total_cost=state.metrics.total_cost + day_cost,
            waste_cost=state.metrics.waste_cost + day_waste,
            wait_days=state.metrics.wait_days + day_wait,
            finished=finished,
            finish_day=day if finished else None,
        ),
        log=log[-40:],
        finished=finished,
        config=config,
        history=state.history + [day_hist],
    )


def run_to_completion(config: SimConfig, seed: int = 42, max_days: int = 2000) -> SimSnapshot:
    rng = create_rng(seed)
    state = create_initial_state(config)
    for _ in range(max_days):
        if state.finished:
            break
        state = step_day(state, rng)
    return state


def build_takt_grid(history: List[DayHistory]):
    if not history:
        return 1, [["" for _ in range(1)] for _ in range(TOTAL_UNITS)]
    last = history[-1].day
    weeks = max(1, (last + DAYS_PER_WEEK - 1) // DAYS_PER_WEEK)
    days_worked = [[[0 for _ in TEAMS] for _ in range(weeks)] for _ in range(TOTAL_UNITS)]
    for h in history:
        w = (h.day - 1) // DAYS_PER_WEEK
        if w < 0 or w >= weeks:
            continue
        for ti, rec in enumerate(h.teams):
            if rec.active_zone is not None and 0 <= rec.active_zone < TOTAL_UNITS:
                days_worked[rec.active_zone][w][ti] += 1
    peak = [[0 for _ in TEAMS] for _ in range(TOTAL_UNITS)]
    for z in range(TOTAL_UNITS):
        for ti in range(len(TEAMS)):
            peak[z][ti] = max(days_worked[z][w][ti] for w in range(weeks))
    work = [["" for _ in range(weeks)] for _ in range(TOTAL_UNITS)]
    for z in range(TOTAL_UNITS):
        for w in range(weeks):
            best_t, best_d = -1, 0
            for ti in range(len(TEAMS)):
                d = days_worked[z][w][ti]
                if peak[z][ti] > 0 and d == peak[z][ti] and d > best_d:
                    best_d, best_t = d, ti
            if best_t >= 0:
                work[z][w] = TEAMS[best_t]["short"]
    return weeks, work
