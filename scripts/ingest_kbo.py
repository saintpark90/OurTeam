"""
전 구단 일정·종료 경기 박스스코어·등말소를 자체 DB에 적재합니다.
하루 1회(새벽) 실행을 전제로 하며, 클라이언트는 이 테이블만 조회합니다.
"""

from __future__ import annotations

import datetime as dt
import html
import json
import os
import re
import time
from typing import Any

import requests
from bs4 import BeautifulSoup

TEAM_ID_TO_NAME = {
    "HH": "한화",
    "OB": "두산",
    "LG": "LG",
    "LT": "롯데",
    "HT": "KIA",
    "SS": "삼성",
    "WO": "키움",
    "SK": "SSG",
    "KT": "KT",
    "NC": "NC",
}
NAME_TO_CODE = {v: k for k, v in TEAM_ID_TO_NAME.items()}
TEAM_CODES = list(TEAM_ID_TO_NAME.keys())

PLAY_DECIDED_RE = re.compile(
    r'<span>([^<]+)</span><em><span class="(?:lose|win|same)">(\d+)</span><span>vs</span>'
    r'<span class="(?:lose|win|same)">(\d+)</span></em><span>([^<]+)</span>',
)
PLAY_PENDING_RE = re.compile(r'<span>([^<]+)</span><em><span>vs</span></em><span>([^<]+)</span>')
GAME_LINK_RE = re.compile(r"gameDate=(\d{8})&gameId=([^&'\"]+)")
GAME_ID_TEAMS_RE = re.compile(r"^(\d{8})([A-Za-z]{2})([A-Za-z]{2})(\d)$")
TIME_CELL_RE = re.compile(r"<b>([^<]+)</b>")
TAG_STRIP_RE = re.compile(r"<[^>]+>")
DAY_CELL_DATE_RE = re.compile(r"(\d{1,2})\.(\d{1,2})\(")
HR_TOKEN_RE = re.compile(r"(\d+)?홈런")
DOUBLE_TOKEN_RE = re.compile(r"(\d+)?2루타")
TRIPLE_TOKEN_RE = re.compile(r"(\d+)?3루타")
STRIKEOUT_TOKEN_RE = re.compile(r"(\d+)?삼진")
REGISTER_ALL_URL = "https://www.koreabaseball.com/Player/RegisterAll.aspx"


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing {name}")
    return value


def headers() -> dict[str, str]:
    return {
        "User-Agent": "Mozilla/5.0 (compatible; OurTeamBatch/1.0)",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.koreabaseball.com/Schedule/Schedule.aspx",
        "Origin": "https://www.koreabaseball.com",
    }


def _strip_tags(value: str) -> str:
    return TAG_STRIP_RE.sub("", value or "").strip()


def _clean_cell_text(value: Any) -> str:
    return html.unescape(_strip_tags(str(value or "")).replace("&nbsp;", "")).strip()


def parse_int(value: Any) -> int | None:
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value.strip())
    return None


def parse_float(value: Any) -> float | None:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return None


def _display_to_team_code(label: str) -> str | None:
    s = (label or "").strip()
    if s in TEAM_ID_TO_NAME:
        return s
    return NAME_TO_CODE.get(s)


def _parse_innings_to_outs(value: str) -> int | None:
    s = (value or "").strip()
    if not s:
        return None
    if " " in s:
        whole, frac = s.split(" ", 1)
        whole_n = parse_int(whole)
        if whole_n is None:
            return None
        outs = whole_n * 3
        if frac.strip() == "1/3":
            outs += 1
        elif frac.strip() == "2/3":
            outs += 2
        return outs
    if "." in s and "/" not in s:
        whole, frac_s = s.split(".", 1)
        whole_n = parse_int(whole)
        if whole_n is None:
            return None
        outs = whole_n * 3
        if frac_s.startswith("1"):
            outs += 1
        elif frac_s.startswith("2"):
            outs += 2
        return outs
    whole_n = parse_int(s)
    return None if whole_n is None else whole_n * 3


def _schedule_list_row_to_game(cells: list[dict[str, Any]], year: int) -> dict[str, Any] | None:
    if len(cells) < 8:
        return None
    tm = TIME_CELL_RE.search(cells[1].get("Text") or "")
    g_tm = tm.group(1).strip() if tm else None
    play_html = cells[2].get("Text") or ""
    dm = PLAY_DECIDED_RE.search(play_html)
    pm = PLAY_PENDING_RE.search(play_html)
    if not dm and not pm:
        return None
    away_score = int(dm.group(2)) if dm else None
    home_score = int(dm.group(3)) if dm else None
    stadium = _strip_tags(cells[7].get("Text") or "") or "미정"
    note = _strip_tags(cells[8].get("Text") or "") if len(cells) > 8 else ""
    game_sc = note if note and note != "-" else None
    link = None
    for cell in cells:
        m = GAME_LINK_RE.search(cell.get("Text") or "")
        if m:
            link = (m.group(1), m.group(2))
            break
    if link:
        g_dt, game_id = link
        teams = GAME_ID_TEAMS_RE.match(game_id.strip())
        if not teams:
            return None
        away_id, home_id = teams.group(2).upper(), teams.group(3).upper()
    else:
        dm_date = DAY_CELL_DATE_RE.search(cells[0].get("Text") or "")
        if not dm_date:
            return None
        g_dt = dt.date(year, int(dm_date.group(1)), int(dm_date.group(2))).strftime("%Y%m%d")
        if dm:
            away_id = _display_to_team_code(dm.group(1))
            home_id = _display_to_team_code(dm.group(4))
        else:
            away_id = _display_to_team_code(pm.group(1))
            home_id = _display_to_team_code(pm.group(2))
        if not away_id or not home_id:
            return None
        game_id = f"{g_dt}{away_id}{home_id}0"
    play_text = cells[3].get("Text") or "" if len(cells) > 3 else ""
    finished = "section=REVIEW" in play_text
    if away_score is not None and not finished and not game_sc:
        game_sc = "진행중"
    winner = None
    if away_score is not None and home_score is not None:
        if away_score > home_score:
            winner = away_id
        elif home_score > away_score:
            winner = home_id
    return {
        "game_id": game_id,
        "season": year,
        "game_date": f"{g_dt[0:4]}-{g_dt[4:6]}-{g_dt[6:8]}",
        "game_time": g_tm,
        "stadium": stadium,
        "away_team_code": away_id,
        "home_team_code": home_id,
        "away_score": away_score,
        "home_score": home_score,
        "winner_team_code": winner,
        "game_status": game_sc or ("종료" if finished else "예정"),
        "finished": finished,
    }


def fetch_all_schedule(year: int) -> list[dict[str, Any]]:
    url = "https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList"
    sr_list = os.getenv("KBO_SR_ID_LIST", "0,9,6")
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for team_id in TEAM_CODES:
        for month in range(3, 12):
            resp = requests.post(
                url,
                data={
                    "leId": 1,
                    "srIdList": sr_list,
                    "seasonId": str(year),
                    "gameMonth": str(month),
                    "teamId": team_id,
                },
                headers=headers(),
                timeout=60,
            )
            resp.raise_for_status()
            payload = resp.json()
            for block in payload.get("rows") or []:
                cells = block.get("row")
                if not isinstance(cells, list):
                    continue
                row = _schedule_list_row_to_game(cells, year)
                if not row or row["game_id"] in seen:
                    continue
                if row["away_team_code"] not in TEAM_ID_TO_NAME or row["home_team_code"] not in TEAM_ID_TO_NAME:
                    continue
                seen.add(row["game_id"])
                out.append(row)
            time.sleep(0.05)
    return out


def fetch_game_list_day(ymd: str) -> list[dict[str, Any]]:
    resp = requests.post(
        "https://www.koreabaseball.com/ws/Main.asmx/GetKboGameList",
        data={"leId": "1", "srId": "0,1,3,4,5,6,7,9", "date": ymd},
        headers={
            **headers(),
            "Referer": "https://www.koreabaseball.com/",
        },
        timeout=30,
    )
    resp.raise_for_status()
    try:
        body = resp.json()
    except json.JSONDecodeError:
        return []
    return body.get("game") or []


def attach_starters(games: list[dict[str, Any]]) -> None:
    by_day: dict[str, list[dict[str, Any]]] = {}
    for g in games:
        by_day.setdefault(g["game_date"].replace("-", ""), []).append(g)
    for ymd, rows in by_day.items():
        try:
            live = fetch_game_list_day(ymd)
        except Exception:
            continue
        by_id = {str(x.get("G_ID")): x for x in live}
        for g in rows:
            src = by_id.get(g["game_id"])
            if not src:
                continue
            g["away_starter_name"] = (src.get("T_PIT_P_NM") or "").strip() or g.get("away_starter_name")
            g["home_starter_name"] = (src.get("B_PIT_P_NM") or "").strip() or g.get("home_starter_name")
        time.sleep(0.05)


def _extract_team_hitters(team_table: dict[str, Any], team_code: str) -> list[dict[str, Any]]:
    try:
        t1 = json.loads(team_table["table1"])
        t2 = json.loads(team_table["table2"])
        t3 = json.loads(team_table["table3"])
    except Exception:
        return []
    r1, r2, r3 = t1.get("rows") or [], t2.get("rows") or [], t3.get("rows") or []
    out = []
    for i in range(min(len(r1), len(r3))):
        row1 = r1[i].get("row") or []
        row3 = r3[i].get("row") or []
        if len(row1) < 3 or len(row3) < 5:
            continue
        name = _clean_cell_text(row1[2].get("Text"))
        if not name:
            continue
        ev_text = ""
        if i < len(r2):
            ev_text = " ".join(_clean_cell_text(c.get("Text")) for c in (r2[i].get("row") or []))
        hr = sum(int(m.group(1) or 1) for m in HR_TOKEN_RE.finditer(ev_text))
        doubles = sum(int(m.group(1) or 1) for m in DOUBLE_TOKEN_RE.finditer(ev_text))
        triples = sum(int(m.group(1) or 1) for m in TRIPLE_TOKEN_RE.finditer(ev_text))
        so = sum(int(m.group(1) or 1) for m in STRIKEOUT_TOKEN_RE.finditer(ev_text))
        ab = parse_int(_clean_cell_text(row3[0].get("Text"))) or 0
        hits = parse_int(_clean_cell_text(row3[1].get("Text"))) or 0
        rbi = parse_int(_clean_cell_text(row3[2].get("Text"))) or 0
        bb = parse_int(_clean_cell_text(row3[3].get("Text"))) or 0
        out.append(
            {
                "player_name": name,
                "team_code": team_code,
                "role": "batter",
                "is_starter": False,
                "at_bats": ab,
                "hits": hits,
                "doubles": doubles,
                "triples": triples,
                "home_runs": hr,
                "rbi": rbi,
                "runs": 0,
                "walks": bb,
                "strikeouts": so,
                "stolen_bases": 0,
            }
        )
    return out


def _extract_team_pitchers(team_table: dict[str, Any], team_code: str) -> list[dict[str, Any]]:
    try:
        table = json.loads(team_table["table"])
    except Exception:
        return []
    out = []
    first = True
    for r in table.get("rows") or []:
        cells = r.get("row") or []
        if len(cells) < 17:
            continue
        vals = [_clean_cell_text(c.get("Text")) for c in cells]
        name = vals[0]
        if not name:
            continue
        result_text = vals[2]
        innings_outs = _parse_innings_to_outs(vals[6])
        out.append(
            {
                "player_name": name,
                "team_code": team_code,
                "role": "pitcher",
                "is_starter": first,
                "innings_pitched_outs": innings_outs,
                "hits_allowed": parse_int(vals[10]) or 0,
                "walks_allowed": parse_int(vals[12]) or 0,
                "strikeouts": parse_int(vals[13]) or 0,
                "earned_runs": parse_int(vals[15]) or 0,
                "wins": 1 if "승" in result_text and "홀드" not in result_text else 0,
                "losses": 1 if "패" in result_text else 0,
                "saves": 1 if "세" in result_text else 0,
                "holds": 1 if "홀드" in result_text else 0,
            }
        )
        first = False
    return out


def fetch_box_both_teams(game_id: str, season: int, away: str, home: str) -> list[dict[str, Any]]:
    resp = requests.post(
        "https://www.koreabaseball.com/ws/Schedule.asmx/GetBoxScoreScroll",
        data={"leId": "1", "srId": "0", "seasonId": str(season), "gameId": game_id},
        headers={
            **headers(),
            "Referer": f"https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameId={game_id}&section=REVIEW",
        },
        timeout=30,
    )
    try:
        payload = resp.json()
    except Exception:
        return []
    hitters = payload.get("arrHitter") or []
    pitchers = payload.get("arrPitcher") or []
    rows: list[dict[str, Any]] = []
    mapping = []
    if len(hitters) >= 2:
        mapping = [(hitters[0], away), (hitters[1], home)]
    for table, code in mapping:
        if isinstance(table, dict):
            rows.extend(_extract_team_hitters(table, code))
    pmap = []
    if len(pitchers) >= 2:
        pmap = [(pitchers[0], away), (pitchers[1], home)]
    for table, code in pmap:
        if isinstance(table, dict):
            rows.extend(_extract_team_pitchers(table, code))
    return rows


def fetch_roster_moves() -> list[dict[str, Any]]:
    resp = requests.get(REGISTER_ALL_URL, headers={"User-Agent": headers()["User-Agent"]}, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    date_match = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", resp.text)
    move_date = (
        f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"
        if date_match
        else dt.date.today().isoformat()
    )
    move_tables = []
    for tb in soup.select("table"):
        heads = [th.get_text(" ", strip=True) for th in tb.select("th")]
        if heads[:3] == ["선수", "포지션", "팀"]:
            move_tables.append(tb)
    if len(move_tables) < 2:
        return []
    out: list[dict[str, Any]] = []

    def parse(tb, move_type: str) -> None:
        for tr in tb.select("tr"):
            tds = [td.get_text(" ", strip=True) for td in tr.select("td")]
            if len(tds) < 3:
                continue
            name, pos, team = tds[0], tds[1], tds[2]
            if not name or "없습니다" in name:
                continue
            code = NAME_TO_CODE.get(team.replace(" 이글스", "").replace("위즈", "").strip()) or NAME_TO_CODE.get(team)
            if not code:
                for k, v in NAME_TO_CODE.items():
                    if k in team:
                        code = v
                        break
            if not code:
                continue
            out.append(
                {
                    "move_date": move_date,
                    "team_code": code,
                    "player_name": name,
                    "position": pos,
                    "move_type": move_type,
                }
            )

    parse(move_tables[0], "register")
    parse(move_tables[1], "deregister")
    return out


class Supabase:
    def __init__(self) -> None:
        self.url = require_env("SUPABASE_URL").rstrip("/")
        self.key = require_env("SUPABASE_SERVICE_ROLE_KEY")

    def _h(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        if extra:
            h.update(extra)
        return h

    def upsert(self, table: str, rows: list[dict[str, Any]], on_conflict: str) -> None:
        if not rows:
            return
        resp = requests.post(
            f"{self.url}/rest/v1/{table}",
            headers=self._h({"Prefer": "resolution=merge-duplicates,return=representation"}),
            params={"on_conflict": on_conflict},
            json=rows,
            timeout=60,
        )
        resp.raise_for_status()

    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        resp = requests.get(f"{self.url}/rest/v1/{table}", headers=self._h(), params=params, timeout=60)
        resp.raise_for_status()
        return resp.json()

    def delete_eq(self, table: str, **filters: str) -> None:
        resp = requests.delete(f"{self.url}/rest/v1/{table}", headers=self._h(), params=filters, timeout=60)
        resp.raise_for_status()


def chunk(items: list[Any], size: int) -> list[list[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def main() -> None:
    year = int(os.getenv("TARGET_SEASON") or dt.date.today().year)
    lookback = int(os.getenv("BOXSCORE_LOOKBACK_DAYS", "10"))
    sb = Supabase()
    print(f"fetch schedule {year}")
    games = fetch_all_schedule(year)
    print(f"games {len(games)}")
    attach_starters(games)
    payloads = []
    for g in games:
        payloads.append(
            {
                "game_id": g["game_id"],
                "season": g["season"],
                "game_date": g["game_date"],
                "game_time": g.get("game_time"),
                "stadium": g.get("stadium"),
                "away_team_code": g["away_team_code"],
                "home_team_code": g["home_team_code"],
                "away_score": g.get("away_score"),
                "home_score": g.get("home_score"),
                "winner_team_code": g.get("winner_team_code"),
                "game_status": g.get("game_status"),
                "away_starter_name": g.get("away_starter_name") or None,
                "home_starter_name": g.get("home_starter_name") or None,
                "updated_at": dt.datetime.utcnow().isoformat() + "Z",
            }
        )
    for part in chunk(payloads, 200):
        sb.upsert("games", part, "game_id")

    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()
    start = (today - dt.timedelta(days=lookback)).isoformat()
    stored = sb.select(
        "games",
        {
            "select": "id,game_id,season,game_date,away_team_code,home_team_code,away_score,game_status",
            "game_date": f"gte.{start}",
            "away_score": "not.is.null",
        },
    )
    print(f"boxscore candidates {len(stored)}")
    for g in stored:
        status = g.get("game_status") or ""
        if re.search(r"취소|노게임|진행", status):
            continue
        rows = fetch_box_both_teams(g["game_id"], g["season"], g["away_team_code"], g["home_team_code"])
        time.sleep(0.08)
        if not rows:
            continue
        sb.delete_eq("game_player_stats", game_uuid=f"eq.{g['id']}")
        for r in rows:
            r["game_uuid"] = g["id"]
        for part in chunk(rows, 150):
            sb.upsert("game_player_stats", part, "game_uuid,player_name,team_code,role")
        print(f"  stats {g['game_id']} {len(rows)}")

    moves = fetch_roster_moves()
    print(f"roster moves {len(moves)}")
    if moves:
        sb.upsert("roster_moves", moves, "move_date,team_code,player_name,move_type")
    print("done")


if __name__ == "__main__":
    main()
