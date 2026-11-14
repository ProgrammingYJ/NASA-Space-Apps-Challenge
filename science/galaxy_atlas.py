"""Source-verified, paged GWGC galaxy references; no synthetic galaxy population.

The adopted VizieR TSV explicitly exports FK5/J2000 RA in *degrees*, although
its prose column description still says decimal hours.  The units row, not that
stale prose, controls conversion.  No ICRS realization, present-epoch motion,
resolved galaxy appearance, stellar membership or planetary system is inferred.
"""

from __future__ import annotations

import csv
import hashlib
import json
import math
import re
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode

MANIFEST = "data/manifests/galaxy_atlas.json"
RAW_ROOT = "data/reference/galaxy-atlas"
RAW = RAW_ROOT + "/gwgc_vizier.tsv"
COMPACT = RAW_ROOT + "/gwgc_galaxies.compact.json"
ALGORITHM = "gwgc-j2000-reference-atlas-v1"
CATALOGUE = "VII/267/gwgc"
LANDING_URL = "https://cdsarc.cds.unistra.fr/viz-bin/cat/VII/267"
PAPER_URL = "https://arxiv.org/abs/1103.0695"
RIGHTS_URL = "https://cds.unistra.fr/vizier-org/licences_vizier.html"
MAX_DOWNLOAD_BYTES = 25_000_000
NATIVE_COLUMNS = (
    "PGC",
    "Name",
    "RAJ2000",
    "DEJ2000",
    "TT",
    "Bmag",
    "e_Bmag",
    "a",
    "e_a",
    "b",
    "e_b",
    "b/a",
    "e_b/a",
    "PA",
    "BMAG",
    "e_BMAG",
    "Dist",
    "e_Dist",
)
FIELDS = (
    "pgc_string",
    "source_name",
    "ra_deg",
    "dec_deg",
    "morphology_code",
    "b_mag",
    "b_mag_error",
    "major_arcmin",
    "major_error_arcmin",
    "minor_arcmin",
    "minor_error_arcmin",
    "axis_ratio",
    "axis_ratio_error",
    "position_angle_deg",
    "absolute_b_mag",
    "absolute_b_mag_error",
    "distance_native_mpc",
    "distance_error_mpc",
)
SOURCE_URL = "https://vizier.cfa.harvard.edu/viz-bin/asu-tsv?" + urlencode(
    {"-source": CATALOGUE, "-out.max": "unlimited", "-out": ",".join(NATIVE_COLUMNS)}
)

# Explicit identity crosswalk: catalogue PGC + its NGC/ESO name, not a nearest
# point guess.  These links retain the separate, existing nine detailed models;
# their independently adopted distances and appearances are never overwritten.
CURATED = {
    "2557": ("NGC0224", "galaxy-m31", ("M31", "Messier 31", "Andromeda")),
    "5818": ("NGC0598", "galaxy-m33", ("M33", "Messier 33", "Triangulum")),
    "28630": ("NGC3031", "galaxy-m81", ("M81", "Messier 81")),
    "41361": ("NGC4486", "galaxy-m87", ("M87", "Messier 87")),
    "17223": ("ESO056-115", "galaxy-lmc", ("LMC", "Large Magellanic Cloud")),
    "3085": ("NGC0292", "galaxy-smc", ("SMC", "Small Magellanic Cloud")),
    "47404": ("NGC5194", "galaxy-m51", ("M51", "Messier 51", "Whirlpool")),
    "42407": ("NGC4594", "galaxy-m104", ("M104", "Messier 104", "Sombrero")),
    "46957": ("NGC5128", "galaxy-centaurus-a", ("Centaurus A", "Cen A")),
}


def _sha(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def _number(value: str) -> float | None:
    if not value.strip():
        return None
    number = float(value)
    if not math.isfinite(number):
        raise ValueError("galaxy_atlas_nonfinite_source_number")
    return number


def parse_vizier_tsv(raw: bytes) -> dict:
    """Validate a CDS export, preserve nullable fields, exclude TT=-9 clusters."""
    if len(raw) > MAX_DOWNLOAD_BYTES:
        raise ValueError("galaxy_atlas_source_too_large")
    text = raw.decode("utf-8-sig")
    comments = [line for line in text.splitlines() if line.startswith("#")]
    if "#Coosys\tJ2000:\teq_FK5 J2000" not in comments:
        raise ValueError("galaxy_atlas_coordinate_reference_changed")
    if any("QUERY_STATUS=OVERFLOW" in line or "#ERROR" in line for line in comments):
        raise ValueError("galaxy_atlas_query_incomplete")
    if not any(line == "#Name: " + CATALOGUE for line in comments):
        raise ValueError("galaxy_atlas_wrong_source_table")
    lines = [line for line in text.splitlines() if line.strip() and not line.startswith("#")]
    if len(lines) < 3:
        raise ValueError("galaxy_atlas_missing_table")
    rows = list(csv.reader(lines, delimiter="\t"))
    columns = tuple(item.strip() for item in rows[0])
    units = tuple(item.strip() for item in rows[1])
    if columns != NATIVE_COLUMNS or len(units) != len(columns):
        raise ValueError("galaxy_atlas_column_contract_changed")
    unit = dict(zip(columns, units, strict=True))
    if unit["RAJ2000"] not in ("deg", "h") or unit["DEJ2000"] != "deg":
        raise ValueError("galaxy_atlas_coordinate_units_changed")
    for name in ("Dist", "e_Dist"):
        if unit[name] != "Mpc":
            raise ValueError("galaxy_atlas_distance_units_changed")
    for name in ("a", "e_a", "b", "e_b"):
        if unit[name] != "arcmin":
            raise ValueError("galaxy_atlas_angular_units_changed")
    if unit["PA"] != "deg" or any(
        unit[name] != "mag" for name in ("Bmag", "e_Bmag", "BMAG", "e_BMAG")
    ):
        raise ValueError("galaxy_atlas_photometry_units_changed")
    if len(rows[2]) != len(columns) or any(not re.fullmatch(r"-+", item) for item in rows[2]):
        raise ValueError("galaxy_atlas_table_separator_changed")
    result, excluded, identifiers = [], [], set()
    for source_row, row in enumerate(rows[3:], start=1):
        if len(row) != len(columns):
            raise ValueError("galaxy_atlas_row_width_changed")
        values = [item.strip() for item in row]
        native = dict(zip(columns, values, strict=True))
        morphology = _number(native["TT"])
        if morphology == -9:
            excluded.append(
                {
                    "source_row": source_row,
                    "name": native["Name"],
                    "pgc_string": native["PGC"] or None,
                    "reason": "TT_minus9_Milky_Way_globular_cluster",
                }
            )
            continue
        if not re.fullmatch(r"[1-9][0-9]*", native["PGC"]):
            raise ValueError("galaxy_atlas_galaxy_identifier_missing_or_invalid")
        pgc = native["PGC"]
        if pgc in identifiers:
            raise ValueError("galaxy_atlas_duplicate_pgc")
        identifiers.add(pgc)
        numbers = [_number(item) for item in values[2:]]
        ra, dec = numbers[0:2]
        if ra is None or dec is None:
            raise ValueError("galaxy_atlas_coordinate_missing")
        if unit["RAJ2000"] == "h":
            ra *= 15
        if not 0 <= ra < 360 or not -90 <= dec <= 90:
            raise ValueError("galaxy_atlas_coordinate_out_of_range")
        numbers[0] = ra
        if morphology is not None and not -6 <= morphology <= 10:
            raise ValueError("galaxy_atlas_unknown_morphology_code")
        for index in (4, 5, 6, 7, 8, 10, 13, 15):
            value = numbers[index]
            if value is not None and value < 0:
                raise ValueError("galaxy_atlas_negative_size_or_error")
        ratio, pa = numbers[9], numbers[11]
        if ratio is not None and not 0 <= ratio <= 1:
            raise ValueError("galaxy_atlas_axis_ratio_out_of_range")
        if pa is not None and not 0 <= pa <= 180:
            raise ValueError("galaxy_atlas_position_angle_out_of_range")
        if not native["Name"]:
            raise ValueError("galaxy_atlas_source_name_missing")
        result.append([pgc, native["Name"], *numbers])
    metadata = {}
    for line in comments:
        if line.startswith("#INFO\t"):
            pair = line.split("\t", 2)[1].split("=", 1)
            if len(pair) == 2:
                metadata[pair[0]] = pair[1]
    return {
        "columns": list(FIELDS),
        "rows": result,
        "excluded": excluded,
        "source_record_count": len(rows) - 3,
        "source_units": unit,
        "metadata": metadata,
    }


def source_record(
    root: Path, relative: str, url: str, label: str, *, required: bool = True
) -> dict:
    path = root / relative
    raw = path.read_bytes()
    return {
        "url": url,
        "resolved_url": url,
        "label": label,
        "local_relative_path": relative,
        "bytes": len(raw),
        "sha256": _sha(raw),
        "retrieved_utc": datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat(),
        "acquisition_client": "curl 8.22.0; normal Schannel TLS chain and hostname verification; bounded request",
        "required_on_server": required,
    }


def stage(root: Path, target: str = "tmp/dev016-galaxy_atlas.json") -> dict:
    """Build a NEW staged manifest from the already downloaded immutable TSV."""
    root = Path(root).resolve()
    target_path = (root / target).resolve()
    if not target_path.is_relative_to(root) or target_path.exists() or (root / COMPACT).exists():
        raise FileExistsError("galaxy_atlas_stage_or_compact_exists")
    parsed = parse_vizier_tsv((root / RAW).read_bytes())
    if (
        parsed["source_record_count"] != 53312
        or len(parsed["rows"]) != 53162
        or len(parsed["excluded"]) != 150
    ):
        raise ValueError("galaxy_atlas_adopted_snapshot_counts_changed")
    compact = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "columns": list(FIELDS),
        "rows": parsed["rows"],
    }
    compact_path = root / COMPACT
    compact_path.write_text(
        json.dumps(compact, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n",
        encoding="utf-8",
    )
    positive = [row[16] for row in parsed["rows"] if row[16] is not None and row[16] > 0]
    source = source_record(
        root,
        RAW,
        SOURCE_URL,
        "GWGC (White, Daw & Dhillon 2011), CDS VII/267, Harvard VizieR export",
    )
    source["service_request_date_utc"] = parsed["metadata"].get("request_date")
    source["service_version"] = parsed["metadata"].get("server_software")
    source["publication_date_in_service"] = parsed["metadata"].get("publication_date")
    source["rights_uri"] = parsed["metadata"].get("rights_uri")
    derived = {
        "local_relative_path": COMPACT,
        "bytes": compact_path.stat().st_size,
        "sha256": _sha(compact_path.read_bytes()),
        "kind": "lossless_nullable_numeric_subset_excluding_Milky_Way_globular_clusters",
        "required_on_server": True,
    }
    manifest = {
        "schema_version": "1.0",
        "algorithm_version": ALGORITHM,
        "created_utc": datetime.now(UTC).isoformat(),
        "source": source,
        "data": derived,
        "record_count": len(parsed["rows"]),
        "spatial_count": len(positive),
        "direction_only_count": len(parsed["rows"]) - len(positive),
        "source_table_records": parsed["source_record_count"],
        "excluded_record_count": len(parsed["excluded"]),
        "exclusion_policy": "TT=-9 is a Milky Way globular cluster and is never counted or rendered as a galaxy",
        "excluded_records": parsed["excluded"],
        "paper": {
            "url": PAPER_URL,
            "doi": "10.1088/0264-9381/28/8/085016",
            "bibcode": "2011CQGra..28h5016W",
            "authors": ["D. J. White", "E. J. Daw", "V. S. Dhillon"],
            "paper_reported_galaxies": 53255,
            "paper_reported_Milky_Way_globular_clusters": 150,
            "count_note": "The article's stated galaxy count differs from this adopted CDS table. The stored table has 53,312 rows; excluding its 150 TT=-9 clusters leaves 53,162 galaxies. No reason for the release-count difference is inferred.",
        },
        "coordinate_reference": "FK5 J2000 as declared by VizieR #Coosys; no ICRS realization or epoch propagation validated",
        "coordinate_units": {"ra_deg": "deg", "dec_deg": "deg"},
        "native_export_units": parsed["source_units"],
        "right_ascension_policy": "Consume the TSV units row. The adopted RAJ2000 output is already degrees, despite inherited prose saying decimal hours. It is not multiplied by 15. A separately supplied hour-unit table is converted once.",
        "distance_kind": "heterogeneous_compiled_catalogue_estimate_not_current_3D_reconstruction",
        "distance_unit": "Mpc",
        "distance_error_policy": "Preserve the reported e_Dist. Methods and errors are heterogeneous, with some errors estimated in the source paper; no full covariance or universal confidence interval is provided. A rounded zero error is not exact physical knowledge.",
        "coverage": {
            "kind": "nearby_compiled_galaxy_catalogue_not_complete_universe",
            "nominal_paper_horizon_mpc": 100,
            "actual_distance_range_mpc": [min(positive), max(positive)],
            "records_above_nominal_100_mpc": sum(value > 100 for value in positive),
            "missing_morphology_records": sum(row[4] is None for row in parsed["rows"]),
            "selected_date_propagation": False,
        },
        "morphology_policy": "Preserve nullable numerical TT codes. Do not infer resolved spiral arms, colour, texture, physical pose or a detailed shape from missing morphology.",
        "photometry_policy": "Bmag/BMAG and their catalogue errors are B-band quantities, not bolometric brightness or SPHEREx flux. No photometric marker brightness calibration is made here.",
        "angular_size_policy": "a/b are published angular diameters in arcmin, not physical radius. PA is degrees from north through east; no 3D inclination is reconstructed.",
        "origin_policy": {
            "compiler": "White, Daw & Dhillon, University of Sheffield, UK",
            "distributor": "CDS, Strasbourg, France",
            "download_mirror": "Harvard/CfA, USA",
            "listed_parent_catalogues": [
                "Tully Nearby/Tully3000",
                "Catalog of Neighboring Galaxies",
                "V8k",
                "HyperLEDA",
            ],
            "Chinese_catalogues_directly_selected": [],
            "LAMOST_used": False,
            "limit": "This records the selected catalogues/providers, not a nationality audit of every historical literature measurement.",
        },
        "rights": {
            "status": "CDS_public_scientific_catalogue_provider_terms_and_attribution",
            "url": RIGHTS_URL,
            "spdx": None,
            "attribution": "White, Daw & Dhillon (2011), Classical and Quantum Gravity 28, 085016; CDS VizieR VII/267",
            "limit": "The service supplies this rights URI. Its full policy page was inaccessible to the browsing tool; no blanket CC-BY, public-domain or unrestricted commercial-redistribution licence is asserted. The paper HTML is retained only for local audit, not server delivery.",
        },
        "limitations": [
            "A finite nearby catalogue is not the complete Universe or an unbiased census; the source paper discusses incompleteness and the Galactic plane/selection effects.",
            "These are fixed FK5/J2000 directions and heterogeneous distance estimates. No galaxy velocities, past/future positions or 3D depth evolution are inferred.",
            "An atlas point identifies a catalogue galaxy. It is not a resolved image, measured surface, star field, individual member star or planetary system.",
            "53,162 actual catalogue galaxies are kept. The 150 TT=-9 Milky Way globular clusters are excluded, including clusters that happen to have PGC identifiers.",
            "The nine existing detailed galaxy models retain their own separate cited positions, distances and illustrative morphology. Cross-links do not overwrite or validate those models.",
        ],
    }
    for pgc, (name, _, _) in CURATED.items():
        matched = [row for row in parsed["rows"] if row[0] == pgc]
        if len(matched) != 1 or matched[0][1] != name:
            raise ValueError("galaxy_atlas_curated_crosswalk_changed")
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8"
    )
    (root / RAW).with_suffix(".tsv.source.json").write_text(
        json.dumps(source, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def _verified(root: Path, record: dict) -> bytes:
    path = (root / record["local_relative_path"]).resolve()
    if not path.is_relative_to(root / RAW_ROOT) or not path.is_file():
        raise ValueError("galaxy_atlas_file_outside_source_root_or_missing")
    raw = path.read_bytes()
    if len(raw) != record["bytes"] or _sha(raw) != record["sha256"]:
        raise ValueError("galaxy_atlas_source_or_data_integrity_mismatch")
    return raw


def _load(root: Path, manifest_path: str = MANIFEST) -> tuple[dict, list[list]]:
    root = Path(root).resolve()
    path = (root / manifest_path).resolve()
    if not path.is_relative_to(root):
        raise ValueError("galaxy_atlas_manifest_outside_root")
    raw = path.read_bytes()
    metadata = json.loads(raw)
    if metadata.get("schema_version") != "1.0" or metadata.get("algorithm_version") != ALGORITHM:
        raise ValueError("galaxy_atlas_schema_unsupported")
    if metadata["source"]["url"] != SOURCE_URL or metadata["source"]["rights_uri"] != RIGHTS_URL:
        raise ValueError("galaxy_atlas_source_identity_changed")
    _verified(root, metadata["source"])
    table = json.loads(_verified(root, metadata["data"]))
    if (
        table.get("schema_version") != "1.0"
        or table.get("algorithm_version") != ALGORITHM
        or table.get("columns") != list(FIELDS)
    ):
        raise ValueError("galaxy_atlas_compact_schema_unsupported")
    rows = table["rows"]
    if len(rows) != metadata["record_count"] or any(len(row) != len(FIELDS) for row in rows):
        raise ValueError("galaxy_atlas_compact_count_or_width_changed")
    metadata = {**metadata, "source_manifest_sha256": _sha(raw)}
    return metadata, rows


def _meta(metadata: dict) -> dict:
    return {
        key: value for key, value in metadata.items() if key not in ("data", "excluded_records")
    }


def _normalise(text: str) -> str:
    # A non-Latin query must not collapse to an empty query and return all rows.
    alphanumeric = "".join(character for character in text.casefold() if character.isalnum())
    return re.sub(r"(?<=[a-z])0+(?=[0-9])", "", alphanumeric)


def _aliases(row: list) -> list[str]:
    return [row[1], "PGC " + row[0], *CURATED.get(row[0], ("", "", ()))[2]]


def _object(row: list) -> dict:
    record = dict(zip(FIELDS, row, strict=True))
    native_distance = record.pop("distance_native_mpc")
    distance = native_distance if native_distance is not None and native_distance > 0 else None
    morphology = record["morphology_code"]
    return {
        **record,
        "object_id": "gwgc-pgc-" + row[0],
        "name": row[1],
        "aliases": _aliases(row),
        "kind": "galaxy",
        "source_catalogue_id": CATALOGUE,
        "coordinate_reference": "FK5 J2000 catalogue reference",
        "distance_mpc": distance,
        "distance_native_mpc": native_distance,
        "distance_status": "catalogue_estimate"
        if distance is not None
        else "unavailable_direction_only",
        "morphology": None if morphology is None else "GWGC numerical T=" + str(morphology),
        "existing_object_id": CURATED.get(row[0], (None, None, ()))[1],
        "surface_resolved": False,
        "individual_stars_or_planets_inferred": False,
        "source": {"url": LANDING_URL, "label": "GWGC / CDS VII/267"},
    }


def export_galaxy_atlas(root: Path, *, manifest_path: str = MANIFEST) -> dict:
    """Compact verified payload for the Node build cache, not 53k verbose rows."""
    metadata, rows = _load(root, manifest_path)
    return {
        **_meta(metadata),
        "columns": list(FIELDS),
        "rows": rows,
        "curated_matches": {"gwgc-pgc-" + pgc: value[1] for pgc, value in CURATED.items()},
        "curated_aliases": {"gwgc-pgc-" + pgc: list(value[2]) for pgc, value in CURATED.items()},
    }


def get_galaxy_atlas(
    root: Path,
    query: str = "",
    cursor: str | None = None,
    limit: int = 50,
    *,
    manifest_path: str = MANIFEST,
) -> dict:
    if (
        not isinstance(query, str)
        or len(query) > 200
        or isinstance(limit, bool)
        or not isinstance(limit, int)
        or not 1 <= limit <= 200
    ):
        raise ValueError("galaxy_atlas_invalid_query_or_limit")
    if cursor is not None and (
        not isinstance(cursor, str) or not re.fullmatch(r"0|[1-9][0-9]{0,6}", cursor)
    ):
        raise ValueError("galaxy_atlas_invalid_cursor")
    offset = int(cursor or "0")
    metadata, rows = _load(root, manifest_path)
    needle = _normalise(query)
    matched = [
        row
        for row in rows
        if not needle
        or any(needle in _normalise(alias) for alias in ["gwgc-pgc-" + row[0], *_aliases(row)])
    ]
    if offset > len(matched):
        raise ValueError("galaxy_atlas_cursor_out_of_range")
    end = min(offset + limit, len(matched))
    return {
        **_meta(metadata),
        "query": query,
        "matched_count": len(matched),
        "objects": [_object(row) for row in matched[offset:end]],
        "next_cursor": str(end) if end < len(matched) else None,
    }


def get_galaxy_atlas_object(
    root: Path, object_id: str, *, manifest_path: str = MANIFEST
) -> dict | None:
    if not isinstance(object_id, str) or not re.fullmatch(r"gwgc-pgc-[1-9][0-9]{0,6}", object_id):
        raise ValueError("galaxy_atlas_invalid_object_id")
    metadata, rows = _load(root, manifest_path)
    row = next((row for row in rows if "gwgc-pgc-" + row[0] == object_id), None)
    return (
        None
        if row is None
        else {**_object(row), "source_manifest_sha256": metadata["source_manifest_sha256"]}
    )


def get_galaxy_atlas_markers(root: Path, *, manifest_path: str = MANIFEST) -> dict:
    metadata, rows = _load(root, manifest_path)
    positive = [row for row in rows if row[16] is not None and row[16] > 0]
    columns = {
        "object_id": ["gwgc-pgc-" + row[0] for row in positive],
        "ra_deg": [row[2] for row in positive],
        "dec_deg": [row[3] for row in positive],
        "distance_mpc": [row[16] for row in positive],
        "morphology_code": [row[4] for row in positive],
    }
    return {
        **_meta(metadata),
        "marker_count": len(positive),
        "columns": columns,
        "curated_matches": {"gwgc-pgc-" + pgc: value[1] for pgc, value in CURATED.items()},
        "marker_kind": "catalogue_reference_points_not_resolved_galaxy_images",
    }
