#!/usr/bin/env python3
"""
Indeed → Pandas parser

- Reads an Indeed-parsed JSON like:
  /mnt/data/indeed_parsed_Maintenance Supervisor_20250905T165931Z.json
- Produces a clean, flat candidates CSV and a JSONL:
  maintenance_supervisor_parsed_pandas.csv
  maintenance_supervisor_parsed_pandas.jsonl

Optional:
- --explode-experiences: also write a long-format CSV (one row per experience)

Requires: pandas, python-dateutil
  pip install pandas python-dateutil
"""

from __future__ import annotations
import argparse
import json
from pathlib import Path
from datetime import date, datetime
import math
from typing import Any, Dict, List, Optional

import pandas as pd
from dateutil import parser as dtparser


# ----------------------------- helpers -------------------------------- #
def parse_date(s: Optional[str]) -> Optional[date]:
    """Parse flexible date strings; return None for empty/'current'."""
    if s is None or (isinstance(s, float) and math.isnan(s)):
        return None
    s = str(s).strip()
    if not s or s.lower() == "current":
        return None
    try:
        return dtparser.parse(s, default=datetime(1, 1, 1)).date()
    except Exception:
        return None


def yyyymm(d: Optional[date]) -> Optional[str]:
    return d.strftime("%Y-%m") if d else None


def duration_months(start: Optional[date], end: Optional[date]) -> Optional[int]:
    if not start:
        return None
    end = end or date.today()
    return (end.year - start.year) * 12 + (end.month - start.month)


def build_name(row: Dict[str, Any]) -> Optional[str]:
    first = (row.get("firstName") or "").strip()
    last = (row.get("lastName") or "").strip()
    name = " ".join([p for p in (first, last) if p])
    return name or None


def summarize_education(edus: Any) -> pd.Series:
    if not isinstance(edus, list) or not edus:
        return pd.Series({"education_summary": None, "highest_degree": None})

    parts: List[str] = []
    highest = None
    best_rank = 0

    for ed in edus:
        degree = (ed.get("degree") or "").strip() or None
        school = (ed.get("school") or "").strip() or None
        f = yyyymm(parse_date(ed.get("fromDate")))
        t = yyyymm(parse_date(ed.get("toDate")))
        seg = " | ".join([p for p in [degree, school, f, t] if p])
        if seg:
            parts.append(seg)

        deglower = (degree or "").lower()
        rank = 0
        if any(k in deglower for k in ["phd", "doctor"]):
            rank = 5
        elif any(k in deglower for k in ["m.sc", "ms", "master", "m."]):
            rank = 4
        elif any(k in deglower for k in ["b.tech", "bachelor", "b.sc", "bs"]):
            rank = 3
        elif any(k in deglower for k in ["diploma", "dae", "intermediate"]):
            rank = 2
        elif any(k in deglower for k in ["matric", "high school"]):
            rank = 1
        if rank > best_rank:
            best_rank = rank
            highest = degree

    return pd.Series(
        {"education_summary": "; ".join(parts) if parts else None, "highest_degree": highest}
    )


def summarize_experiences(exps: Any) -> pd.Series:
    total_months = 0
    current_titles: List[str] = []
    norm: List[Dict[str, Any]] = []

    if not isinstance(exps, list) or not exps:
        return pd.Series(
            {"experiences_json": "[]", "current_title": None, "total_experience_years": None}
        )

    for e in exps:
        title = (e.get("title") or "").strip() or None
        company = (e.get("company") or "").strip() or None
        raw_to = e.get("toDate")
        s = parse_date(e.get("fromDate"))
        t = parse_date(raw_to)
        is_current = isinstance(raw_to, str) and raw_to.strip().lower() == "current"
        t_for_dur = date.today() if (is_current and not t) else t
        dur_m = duration_months(s, t_for_dur)

        if dur_m:
            total_months += dur_m
        if is_current and title:
            current_titles.append(title)

        norm.append(
            {
                "title": title,
                "company": company,
                "from": yyyymm(s),
                "to": "current" if is_current else yyyymm(t),
                "duration_months": dur_m,
            }
        )

    years = round(total_months / 12, 2) if total_months else None
    return pd.Series(
        {
            "experiences_json": json.dumps(norm, ensure_ascii=False),
            "current_title": "; ".join(current_titles) if current_titles else None,
            "total_experience_years": years,
        }
    )


def explode_experiences(matches_df: pd.DataFrame) -> pd.DataFrame:
    """
    Returns a long-format DataFrame (one row per experience), carrying candidate fields.
    """
    rows: List[Dict[str, Any]] = []
    for _, cand in matches_df.iterrows():
        exps = cand.get("experiences")
        if not isinstance(exps, list) or not exps:
            continue
        name = build_name(cand)
        for e in exps:
            title = (e.get("title") or "").strip() or None
            company = (e.get("company") or "").strip() or None
            raw_to = e.get("toDate")
            s = parse_date(e.get("fromDate"))
            t = parse_date(raw_to)
            is_current = isinstance(raw_to, str) and raw_to.strip().lower() == "current"
            t_for_dur = date.today() if (is_current and not t) else t
            dur_m = duration_months(s, t_for_dur)
            rows.append(
                {
                    "name": name,
                    "locale": cand.get("locale"),
                    "location": cand.get("location"),
                    "resume_type": cand.get("resumeType"),
                    "free_to_contact": cand.get("isFreeToContact"),
                    "skill_list": cand.get("skills"),
                    "exp_title": title,
                    "exp_company": company,
                    "exp_from": yyyymm(s),
                    "exp_to": "current" if is_current else yyyymm(t),
                    "exp_duration_months": dur_m,
                }
            )
    return pd.DataFrame(rows)


# ------------------------------ main ---------------------------------- #
def main():
    p = argparse.ArgumentParser()
    p.add_argument(
        "-i",
        "--input",
        type=Path,
        required=True,
        help="Path to Indeed parsed JSON (e.g., indeed_parsed_*.json)",
    )
    p.add_argument(
        "--out-csv",
        type=Path,
        default=Path("maintenance_supervisor_parsed_pandas.csv"),
        help="Output CSV path (flat candidates table)",
    )
    p.add_argument(
        "--out-jsonl",
        type=Path,
        default=Path("maintenance_supervisor_parsed_pandas.jsonl"),
        help="Output JSONL path (one candidate per line)",
    )
    p.add_argument(
        "--explode-experiences",
        action="store_true",
        help="Also write a long-format CSV with one row per experience",
    )
    p.add_argument(
        "--exploded-out",
        type=Path,
        default=Path("maintenance_supervisor_experiences_long.csv"),
        help="Output CSV path for the long-format experiences table (used with --explode-experiences)",
    )
    args = p.parse_args()

    # Load payload & extract matches
    payload = json.loads(args.input.read_text(encoding="utf-8"))
    matches = (payload.get("parsed") or {}).get("matches") or []
    df = pd.DataFrame(matches)

    # Build output (flat) with pandas
    out = pd.DataFrame()
    out["name"] = df.apply(build_name, axis=1)
    out["locale"] = df.get("locale")
    out["location"] = df.get("location")
    out["resume_type"] = df.get("resumeType")
    out["free_to_contact"] = df.get("isFreeToContact")

    # Skills joined by semicolons
    out["skills"] = df["skills"].apply(
        lambda xs: "; ".join([s.strip() for s in xs if isinstance(s, str) and s.strip()])
        if isinstance(xs, list)
        else None
    )

    # Education summary + highest degree
    edu_df = df["educations"].apply(summarize_education)
    out = pd.concat([out, edu_df], axis=1)

    # Experiences summary
    exp_df = df["experiences"].apply(summarize_experiences)
    out = pd.concat([out, exp_df], axis=1)

    # Save flat CSV + JSONL
    out.to_csv(args.out_csv, index=False)
    with args.out_jsonl.open("w", encoding="utf-8") as f:
        for _, row in out.iterrows():
            # Drop NaNs for a cleaner JSONL
            rec = {k: v for k, v in row.items() if pd.notna(v)}
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

    # Optional: exploded experiences
    if args.explode_experiences:
        long_df = explode_experiences(df)
        long_df.to_csv(args.exploded_out, index=False)

    print(f"Wrote: {args.out_csv}")
    print(f"Wrote: {args.out_jsonl}")
    if args.explode_experiences:
        print(f"Wrote: {args.exploded_out}")


if __name__ == "__main__":
    main()
