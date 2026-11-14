"""Complete, resumable snapshot of NASA Science's public planet/star collections.

This fallback retains editorial fields and estimates without misrepresenting
them as PS literature solutions. Acquisition is separate from the offline API.
"""

import hashlib
import html
import json
import re
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from science.exoplanets import CATALOG, COLUMNS, validate_rows

LIMITATIONS = [
    "All entries returned by NASA Science's public exoplanet catalog at acquisition are included. This is a dated public catalog snapshot, not a census of the universe.",
    "Archive TAP was unreachable from this environment. These are NASA Science editorial/catalog fields, not claimed to be self-consistent PS default literature solutions.",
    "Some radius/mass values are estimates; original labels and raw fields are retained. Missing errors/covariance are not estimated here.",
    "No resolved exoplanet surface maps are supplied. Rendered terrain, colors, clouds, atmosphere and rotation are explicitly illustrative.",
    "Sky directions have no verified common epoch or proper-motion propagation. Distance units have not been independently verified, so no 3D stellar distance is inferred.",
    "Orbital orientation and phase are generally unavailable. Orbital arrangement is schematic, with an assumed phase/orientation, not a measured current position.",
    "No existence, habitability, detection or discovery probability is computed.",
]


def acquire(root: Path) -> dict:
    if (root / CATALOG).exists():
        raise FileExistsError("exoplanet_snapshot_already_exists")
    directory = root / "data/reference/catalog/nasa_science"
    directory.mkdir(parents=True, exist_ok=True)
    sources = []

    def collection(kind: str) -> list:
        all_rows, page, total = [], 1, None
        while total is None or len(all_rows) < total:
            url = (
                "https://science.nasa.gov/wp-json/wp/v2/"
                + kind
                + "?"
                + urlencode(
                    {
                        "per_page": 100,
                        "page": page,
                        "orderby": "id",
                        "order": "asc",
                        "_fields": "id,link,title,acf,modified_gmt",
                    }
                )
            )
            path = directory / f"{kind}_{page:03}.json"
            record_path = path.with_suffix(".source.json")
            if path.is_file() and record_path.is_file():
                raw = path.read_bytes()
                record = json.loads(record_path.read_bytes())
                if record["url"] != url or hashlib.sha256(raw).hexdigest() != record["sha256"]:
                    raise ValueError("download_resume_integrity_mismatch")
                count = record["collection_total"]
            else:
                for attempt in range(3):
                    try:
                        with urlopen(url, timeout=25) as response:
                            count = int(response.headers["X-WP-Total"])
                            raw = response.read(4_000_001)
                        break
                    except OSError:
                        if attempt == 2:
                            raise
                        time.sleep(1)
                if len(raw) > 4_000_000:
                    raise ValueError("catalog_page_limit")
                record = {
                    "url": url,
                    "relative_path": path.relative_to(root).as_posix(),
                    "sha256": hashlib.sha256(raw).hexdigest(),
                    "bytes": len(raw),
                    "retrieved_utc": datetime.now(UTC).isoformat(),
                    "collection_total": count,
                }
                path.write_bytes(raw)
                record_path.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
            if total is None:
                total = count
            if total != count:
                raise ValueError("catalog_changed_during_acquisition")
            rows = json.loads(raw)
            if not rows:
                raise ValueError("incomplete_catalog_page")
            all_rows.extend(rows)
            sources.append(record)
            if page % 10 == 0:
                print(f"{kind}: {len(all_rows)}/{total}", flush=True)
            page += 1
        if len(all_rows) != total or len({r["id"] for r in all_rows}) != total:
            raise ValueError("duplicate_or_missing_catalog_pages")
        return all_rows

    planets = collection("exoplanet")
    stars = {star["id"]: star for star in collection("star")}
    records = []
    for entry in planets:
        acf = entry["acf"]
        star = stars.get(acf.get("star_id"), {}).get("acf", {})
        row = dict.fromkeys(COLUMNS)
        row.update(
            pl_name=html.unescape(
                acf.get("display_name")
                or entry["title"]["rendered"]
                or acf.get("exo_id")
                or f"NASA entry {entry['id']}"
            ),
            hostname=acf.get("pl_hostname") or star.get("display_name") or "Unknown",
            discoverymethod=acf.get("pl_discmethod"),
            disc_year=acf.get("pl_disc"),
            ra=star.get("ra"),
            dec=star.get("dec"),
            pl_orbper=acf.get("pl_orbper"),
            pl_orbsmax=acf.get("pl_orbsmax"),
            pl_orbeccen=acf.get("pl_orbeccen"),
            pl_rade=acf.get("pl_rade"),
            st_teff=star.get("st_teff"),
            st_rad=star.get("st_rad"),
            st_mass=star.get("st_mass"),
            rowupdate=entry.get("modified_gmt"),
        )
        row["nasa"] = {
            "id": entry["id"],
            "url": entry["link"],
            "acf": acf,
            "star_url": stars.get(acf.get("star_id"), {}).get("link"),
            "star_acf": star,
            "appearance_class": acf.get("planet_type", "Unknown"),
            "description": html.unescape(
                re.sub("<[^>]+>", "", acf.get("derived_description") or "")
            ),
            "radius_display": acf.get("planet_radius"),
            "mass_display": acf.get("planet_mass"),
            "radius_estimated": "estimate" in str(acf.get("planet_radius", "")).lower(),
            "distance_value_unit_unverified": acf.get("st_dist"),
        }
        for key in COLUMNS:
            if row[key] == "":
                row[key] = None
        records.append(row)
    records.sort(key=lambda r: r["pl_name"].casefold())
    validate_rows(records)
    source_bytes = json.dumps(sources, sort_keys=True, separators=(",", ":")).encode()
    data = {
        "schema_version": "1.0",
        "catalog_version": "nasa-science-catalog-v1",
        "retrieved_utc": datetime.now(UTC).isoformat(),
        "table": "NASA Science public exoplanet/star catalog collections",
        "url": "https://science.nasa.gov/exoplanets/exoplanet-catalog/",
        "documentation": "https://science.nasa.gov/exoplanets/exoplanet-catalog/",
        "raw_sha256": hashlib.sha256(source_bytes).hexdigest(),
        "raw_bytes": sum(s["bytes"] for s in sources),
        "sources": sources,
        "planet_count": len(records),
        "host_count": len({r["hostname"] for r in records}),
        "limitations": LIMITATIONS,
        "records": records,
    }
    # Raw public fields remain in the hashed immutable page files. Keep the
    # Git manifest small; sparse omissions are restored to explicit null by
    # load_catalog, never to numeric zero.
    for row in data["records"]:
        row["nasa"].pop("acf", None)
        row["nasa"].pop("star_acf", None)
        row["nasa"].pop("description", None)
    data["records"] = [{k: v for k, v in row.items() if v is not None} for row in data["records"]]
    data["records_format"] = "sparse_catalog_fields_v1"
    target = root / CATALOG
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(data, stream, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        stream.write("\n")
    return data


if __name__ == "__main__":
    data = acquire(Path(__file__).resolve().parents[1])
    print(
        json.dumps(
            {
                key: data[key]
                for key in (
                    "planet_count",
                    "host_count",
                    "raw_sha256",
                    "raw_bytes",
                    "retrieved_utc",
                )
            }
        )
    )
