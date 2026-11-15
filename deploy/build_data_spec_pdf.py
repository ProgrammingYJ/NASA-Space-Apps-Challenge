#!/usr/bin/env python3
"""Render the complete, unedited Data_Spec Markdown as an auditable linked PDF.

Build-only dependencies (never needed by the Node website):
    reportlab>=4.4,<5 markdown-it-py>=3,<5 linkify-it-py fonttools>=4.50 pypdf>=5,<7

Example, after the PDF skill's artifact-operation marker has been run by the
operator immediately before authoring:
    python deploy/build_data_spec_pdf.py --source Data_Spec.md \
      --output output/pdf/PlanetX_Data_Spec.pdf \
      --font 'data/reference/document-fonts/NotoSansKR[wght].ttf' \
      --built-at 2026-11-15T03:00:00Z --version 0.16.0

No network requests, source edits, summarization, or removal of historic records.
HTTP(S) sources become clickable URI annotations. Local archive paths remain
visible local references; they are not fabricated public download URLs. The
unchanged Markdown and font license are also embedded as attachments. A separate
manifest contains the final PDF hash, avoiding a self-referential document hash.
Actual rendering/visual review remains a separate release step for the operator.
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import html
import importlib.metadata
import json
import os
import re
import sys
import tempfile
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

ALGORITHM = "full-markdown-linked-cjk-pdf-v1"
DEFAULT_FONT_URL = (
    "https://raw.githubusercontent.com/google/fonts/"
    "b38c5c93af322c45f633e17ac440ec1e6c94d489/"
    "ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf"
)
DEFAULT_LICENSE_URL = (
    "https://raw.githubusercontent.com/google/fonts/"
    "b38c5c93af322c45f633e17ac440ec1e6c94d489/ofl/notosanskr/OFL.txt"
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text).replace("\u200b", "")


def parse_utc(value: str) -> datetime:
    stamp = datetime.fromisoformat(value)
    if stamp.tzinfo is None or stamp.utcoffset() != UTC.utcoffset(stamp):
        raise ValueError("--built-at must include an explicit UTC Z or +00:00 offset")
    return stamp.astimezone(UTC)


def slug(text: str) -> str:
    value = unicodedata.normalize("NFC", text).strip().lower()
    return re.sub(r"\s+", "-", re.sub(r"[^\w\-\s]", "", value))


def inline_plain(tokens: list[Any]) -> str:
    result: list[str] = []
    for token in tokens:
        if token.type in {"text", "code_inline", "html_inline"}:
            result.append(token.content)
        elif token.type in {"softbreak", "hardbreak"}:
            result.append("\n")
        elif token.type == "image":
            result.append(token.content)
        elif token.children:
            result.append(inline_plain(token.children))
    return "".join(result)


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".pending")
    temporary.write_bytes(data)
    os.replace(temporary, path)


class EmbeddedFonts:
    def __init__(self, args: argparse.Namespace, temporary: Path):
        from fontTools.ttLib import TTFont as FontToolsFont
        from fontTools.varLib.instancer import instantiateVariableFont
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        self.records: list[dict[str, Any]] = []
        self.coverage: dict[str, set[int]] = {}
        self.regular = "PlanetXDocument-Regular"
        self.bold = "PlanetXDocument-Bold"
        self.fallbacks: list[str] = []

        def register(path: Path, name: str, weight: int) -> None:
            raw = path.read_bytes()
            font = FontToolsFont(path, lazy=False)
            axes: dict[str, float] = {}
            derived = path
            if "glyf" not in font:
                raise ValueError(f"Use an outline TrueType .ttf (glyf), not CFF/OTF: {path.name}")
            if "fvar" in font:
                axes = {axis.axisTag: float(axis.defaultValue) for axis in font["fvar"].axes}
                if "wght" in axes:
                    axes["wght"] = weight
                font = instantiateVariableFont(font, axes, inplace=False)
                # A named derivative avoids using a reserved original family name.
                for record in list(font["name"].names):
                    if record.nameID in {1, 2, 3, 4, 6, 16, 17}:
                        value = "Bold" if weight >= 600 else "Regular"
                        if record.nameID in {1, 16}:
                            value = "PlanetXDocumentFont"
                        elif record.nameID not in {2, 17}:
                            value = name
                        font["name"].setName(
                            value, record.nameID, record.platformID, record.platEncID, record.langID
                        )
                derived = temporary / (name + ".ttf")
                font.save(derived)
            self.coverage[name] = set((font.getBestCmap() or {}).keys())
            font.close()
            pdfmetrics.registerFont(TTFont(name, str(derived)))
            self.records.append(
                {
                    "role": name,
                    "input_filename": path.name,
                    "input_bytes": len(raw),
                    "input_sha256": sha256(raw),
                    "embedded_instance_sha256": sha256(derived.read_bytes()),
                    "instance_axes": axes,
                    "modified_family_name": "PlanetXDocumentFont" if axes else None,
                    "embedding": "ReportLab subset with ToUnicode mapping",
                }
            )

        register(args.font, self.regular, 400)
        register(args.font_bold or args.font, self.bold, 700)
        for index, path in enumerate(args.fallback_font):
            name = f"PlanetXDocument-Fallback-{index}"
            register(path, name, 400)
            self.fallbacks.append(name)
        pdfmetrics.registerFontFamily(
            self.regular,
            normal=self.regular,
            bold=self.bold,
            italic=self.regular,
            boldItalic=self.bold,
        )

    def preflight(self, text: str) -> None:
        available = set().union(*self.coverage.values())
        missing = sorted(
            {
                ord(character)
                for character in text
                if not character.isspace() and ord(character) not in available
            }
        )
        if missing:
            details = ", ".join(
                f"U+{point:04X} {unicodedata.name(chr(point), 'UNNAMED')}" for point in missing[:80]
            )
            raise ValueError(
                "Font coverage incomplete; provide --fallback-font for these characters: " + details
            )

    def markup(self, text: str, bold: bool = False) -> str:
        preferred = self.bold if bold else self.regular
        choices = [preferred, self.regular, self.bold, *self.fallbacks]
        runs: list[str] = []
        run: list[str] = []
        selected = preferred
        for character in text:
            font = next(
                (
                    name
                    for name in choices
                    if character.isspace() or ord(character) in self.coverage[name]
                ),
                None,
            )
            if font is None:
                raise ValueError(f"Missing glyph U+{ord(character):04X}")
            if font != selected and run:
                runs.append(f'<font name="{selected}">{html.escape("".join(run))}</font>')
                run = []
            selected = font
            run.append(character)
        if run:
            runs.append(f'<font name="{selected}">{html.escape("".join(run))}</font>')
        return "".join(runs)


class FullMarkdownRenderer:
    def __init__(
        self, tokens: list[Any], fonts: EmbeddedFonts, width: float, args: argparse.Namespace
    ):
        from reportlab.lib import colors
        from reportlab.lib.styles import ParagraphStyle

        self.tokens, self.fonts, self.width, self.args = tokens, fonts, width, args
        self.links: collections.Counter[str] = collections.Counter()
        self.local_links: collections.Counter[str] = collections.Counter()
        self.metrics: collections.Counter[str] = collections.Counter()
        self.visible_text: list[str] = []
        self.heading_names: dict[int, tuple[str, str]] = {}
        self.anchors: dict[str, str] = {}
        duplicates: collections.Counter[str] = collections.Counter()
        for index, token in enumerate(tokens):
            if token.type == "heading_open":
                text = inline_plain(tokens[index + 1].children or [])
                base = slug(text)
                suffix = f"-{duplicates[base]}" if duplicates[base] else ""
                duplicates[base] += 1
                anchor = "heading-" + base + suffix
                self.heading_names[index] = (anchor, text)
                self.anchors[base + suffix] = anchor
        self.styles: dict[str, Any] = {
            "body": ParagraphStyle(
                "Body",
                fontName=fonts.regular,
                fontSize=9.4,
                leading=14,
                textColor=colors.HexColor("#1b2634"),
                spaceAfter=7,
                wordWrap="LTR",
                splitLongWords=1,
                allowWidows=1,
                allowOrphans=1,
            ),
            "cell": ParagraphStyle(
                "Cell",
                fontName=fonts.regular,
                fontSize=args.table_font_size,
                leading=args.table_font_size * 1.42,
                wordWrap="LTR",
                splitLongWords=1,
                allowWidows=1,
                allowOrphans=1,
            ),
            "headcell": ParagraphStyle(
                "HeadCell",
                fontName=fonts.bold,
                fontSize=args.table_font_size,
                leading=args.table_font_size * 1.42,
                textColor=colors.white,
                wordWrap="LTR",
                splitLongWords=1,
            ),
        }
        for level, size in [(1, 20), (2, 14), (3, 11), (4, 10), (5, 9.6), (6, 9.4)]:
            self.styles[f"h{level}"] = ParagraphStyle(
                f"Heading{level}",
                parent=self.styles["body"],
                fontName=fonts.bold,
                fontSize=size,
                leading=size * 1.4,
                spaceBefore=15 if level < 3 else 10,
                spaceAfter=7,
                keepWithNext=True,
                textColor=colors.HexColor("#193a56"),
            )

    def inline(self, tokens: list[Any], bold: bool = False) -> str:
        result: list[str] = []
        index = 0
        while index < len(tokens):
            token = tokens[index]
            kind = token.type
            if kind in {"text", "code_inline", "html_inline"}:
                self.metrics["inline_text_nodes"] += 1
                self.visible_text.append(token.content)
                markup = self.fonts.markup(token.content, bold)
                result.append(
                    f'<font backColor="#eef1f4">{markup}</font>'
                    if kind == "code_inline"
                    else markup
                )
            elif kind in {"softbreak", "hardbreak"}:
                result.append("<br/>")
                self.visible_text.append("\n")
            elif kind in {"strong_open", "em_open", "s_open"}:
                closing = kind.replace("open", "close")
                depth, end = 1, index + 1
                while end < len(tokens):
                    if tokens[end].type == kind:
                        depth += 1
                    elif tokens[end].type == closing:
                        depth -= 1
                    if depth == 0:
                        break
                    end += 1
                if end == len(tokens):
                    raise ValueError(f"Unclosed inline token: {kind}")
                result.append(self.inline(tokens[index + 1 : end], bold or kind == "strong_open"))
                index = end
            elif kind == "link_open":
                end = index + 1
                while end < len(tokens) and tokens[end].type != "link_close":
                    end += 1
                if end == len(tokens):
                    raise ValueError("Unclosed Markdown link")
                href = token.attrGet("href") or ""
                label = inline_plain(tokens[index + 1 : end])
                content = self.inline(tokens[index + 1 : end], bold)
                scheme = urlparse(href).scheme.lower()
                if scheme in {"http", "https"}:
                    self.links[href] += 1
                    result.append(
                        f'<link href="{html.escape(href, quote=True)}" color="#155a92">{content}</link>'
                    )
                elif href.startswith("#") and unquote(href[1:]) in self.anchors:
                    anchor = self.anchors[unquote(href[1:])]
                    result.append(f'<link href="#{anchor}" color="#155a92">{content}</link>')
                else:
                    self.local_links[href] += 1
                    result.append(content)
                    if unquote(href) != label:
                        self.visible_text.append(" (" + href + ")")
                        result.append(self.fonts.markup(" (" + href + ")", bold))
                index = end
            elif kind == "image":
                # Current Data_Spec has no image nodes. Do not silently replace a
                # future image-containing source with an incomplete text-only PDF.
                raise ValueError(
                    "Markdown images require explicit local-asset handling before publication"
                )
            else:
                raise ValueError(f"Unsupported inline token; source would be incomplete: {kind}")
            index += 1
        return "".join(result)

    def table(self, start: int) -> tuple[Any, int]:
        from reportlab.lib import colors
        from reportlab.platypus import LongTable, Paragraph, TableStyle

        rows: list[list[Any]] = []
        row: list[Any] = []
        is_header = False
        headers: list[str] = []
        index = start + 1
        while index < len(self.tokens):
            token = self.tokens[index]
            if token.type == "table_close":
                break
            if token.type == "tr_open":
                row = []
            elif token.type in {"th_open", "td_open"}:
                is_header = token.type == "th_open"
            elif token.type == "inline":
                if is_header:
                    headers.append(inline_plain(token.children or []))
                row.append(
                    Paragraph(
                        self.inline(token.children or [], is_header),
                        self.styles["headcell" if is_header else "cell"],
                    )
                )
                self.metrics["table_cells"] += 1
            elif token.type == "tr_close":
                rows.append(row)
            elif token.type not in {
                "thead_open",
                "thead_close",
                "tbody_open",
                "tbody_close",
                "th_close",
                "td_close",
            }:
                raise ValueError(f"Unsupported table token: {token.type}")
            index += 1
        if index == len(self.tokens) or not rows:
            raise ValueError("Empty or unclosed Markdown table")
        columns = len(rows[0])
        if any(len(values) != columns for values in rows):
            raise ValueError("Inconsistent Markdown table columns")
        # Bounded weights keep every column readable and preserve long path/URL
        # columns. Long-word wrapping also splits uninterrupted 64-character hashes.
        weights = [
            1.7
            if re.search(r"경로|URL|url|출처|원문|path", title)
            else 1.35
            if re.search(r"SHA|바이트|bytes", title)
            else 1.2
            for title in headers
        ]
        if len(weights) != columns:
            weights = [1.0] * columns
        widths = [self.width * weight / sum(weights) for weight in weights]
        # Use the normal multi-fragment line path (LTR + splitLongWords), rather
        # than ReportLab 4.5.1's incompatible CJK FragLine split path. Oversized
        # source rows may continue across pages without clipping or shortening.
        table = LongTable(
            rows, colWidths=widths, repeatRows=1, hAlign="LEFT", splitByRow=1, splitInRow=1
        )
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#193a56")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("GRID", (0, 0), (-1, -1), 0.22, colors.HexColor("#ced6df")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#f5f7fa")],
                    ),
                ]
            )
        )
        self.metrics["tables"] += 1
        self.metrics["source_table_rows_including_headers"] += len(rows)
        return table, index

    def render(self) -> list[Any]:
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.platypus import HRFlowable, Paragraph, Spacer

        story: list[Any] = []
        lists: list[dict[str, Any]] = []
        quote_depth = 0
        index = 0
        while index < len(self.tokens):
            token = self.tokens[index]
            kind = token.type
            if kind == "table_open":
                table, index = self.table(index)
                story.extend([Spacer(1, 5), table, Spacer(1, 9)])
            elif kind == "heading_open":
                anchor, text = self.heading_names[index]
                heading = Paragraph(
                    self.inline(self.tokens[index + 1].children or [], True), self.styles[token.tag]
                )
                heading._data_spec_heading = (anchor, text, int(token.tag[1:]) - 1)
                story.append(heading)
                self.metrics["headings"] += 1
                index += 2
            elif kind == "paragraph_open":
                inline = self.tokens[index + 1]
                if inline.type != "inline" or self.tokens[index + 2].type != "paragraph_close":
                    raise ValueError("Unsupported non-inline paragraph")
                prefix = ""
                if lists and lists[-1].get("pending"):
                    state = lists[-1]
                    prefix = f"{state['number']}. " if state["ordered"] else "- "
                    state["pending"] = False
                style = ParagraphStyle(
                    "Indented",
                    parent=self.styles["body"],
                    leftIndent=11 * (len(lists) + quote_depth),
                )
                story.append(
                    Paragraph(self.fonts.markup(prefix) + self.inline(inline.children or []), style)
                )
                self.metrics["paragraphs"] += 1
                index += 2
            elif kind in {"bullet_list_open", "ordered_list_open"}:
                lists.append(
                    {
                        "ordered": kind == "ordered_list_open",
                        "number": int(token.attrGet("start") or 1) - 1,
                    }
                )
            elif kind == "list_item_open":
                lists[-1]["pending"] = True
                lists[-1]["number"] += 1
                self.metrics["list_items"] += 1
            elif kind in {"bullet_list_close", "ordered_list_close"}:
                lists.pop()
            elif kind == "list_item_close":
                pass
            elif kind == "blockquote_open":
                quote_depth += 1
            elif kind == "blockquote_close":
                quote_depth -= 1
            elif kind == "hr":
                story.append(HRFlowable(width="100%", thickness=0.5, spaceBefore=6, spaceAfter=8))
            elif kind in {"fence", "code_block", "html_block"}:
                # Literal source, never execute code or imported HTML directives.
                for line in token.content.splitlines():
                    story.append(
                        Paragraph(
                            self.fonts.markup(line.replace(" ", "\u00a0")) or "<br/>",
                            self.styles["cell"],
                        )
                    )
                    self.visible_text.append(line)
                story.append(Spacer(1, 7))
                self.metrics["literal_blocks"] += 1
            else:
                raise ValueError(f"Unsupported block token; refusing content loss: {kind}")
            index += 1
        return story


def build(args: argparse.Namespace) -> dict[str, Any]:
    from markdown_it import MarkdownIt
    from pypdf import PdfReader, PdfWriter
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A3, A4, LETTER, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfgen import canvas as canvas_module
    from reportlab.platypus import (
        LongTable,
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        TableStyle,
    )

    source_raw = args.source.read_bytes()
    source_text = source_raw.decode("utf-8-sig", errors="strict")
    source_hash = sha256(source_raw)
    stamp = parse_utc(args.built_at)
    built_at = stamp.isoformat().replace("+00:00", "Z")
    license_path = args.font_license or args.font.parent / "OFL.txt"
    license_raw = license_path.read_bytes()
    if b"SIL OPEN FONT LICENSE" not in license_raw.upper():
        raise ValueError("Provide the font's authentic SIL OFL license with --font-license")
    if len(args.fallback_font_license) != len(args.fallback_font):
        raise ValueError(
            "Provide one --fallback-font-license per --fallback-font, in the same order"
        )
    fallback_licenses: list[tuple[dict[str, Any], bytes]] = []
    for index, (font_path, fallback_license_path) in enumerate(
        zip(args.fallback_font, args.fallback_font_license, strict=True)
    ):
        raw_license = fallback_license_path.read_bytes()
        if b"SIL OPEN FONT LICENSE" not in raw_license.upper():
            raise ValueError(
                f"Fallback font license is not an authentic SIL OFL: {fallback_license_path.name}"
            )
        fallback_licenses.append(
            (
                {
                    "font_filename": font_path.name,
                    "license_filename": fallback_license_path.name,
                    "license_sha256": sha256(raw_license),
                    "license_bytes": len(raw_license),
                    "attachment_filename": f"DocumentFallbackFont-{index + 1}-OFL.txt",
                },
                raw_license,
            )
        )
    provenance_path = args.font_provenance or args.font.parent / "font-source.json"
    font_provenance = (
        json.loads(provenance_path.read_text("utf-8"))
        if provenance_path.exists()
        else {
            "font_source_url": DEFAULT_FONT_URL,
            "license_source_url": DEFAULT_LICENSE_URL,
            "note": "URLs are references; no automatic download or independent upstream verification was performed by this script.",
        }
    )
    verified_font_pins: list[dict[str, Any]] = []
    if provenance_path.exists():
        entries = font_provenance.get("files", [])
        if not isinstance(entries, list) or font_provenance.get("license") != "OFL-1.1":
            raise ValueError("Font provenance must declare OFL-1.1 and a files pin list")
        for path in [args.font, license_path, *args.fallback_font, *args.fallback_font_license]:
            matches = [
                entry
                for entry in entries
                if str(entry.get("path", "")).replace("\\", "/").rsplit("/", 1)[-1] == path.name
            ]
            if len(matches) != 1:
                raise ValueError(f"Missing or ambiguous source pin for font/license: {path.name}")
            record, raw = matches[0], path.read_bytes()
            if record.get("sha256") != sha256(raw) or record.get("bytes") != len(raw):
                raise ValueError(f"Font/license source pin mismatch: {path.name}")
            if urlparse(record.get("source_url", "")).scheme != "https":
                raise ValueError(
                    f"Font/license provenance requires an HTTPS original URL: {path.name}"
                )
            verified_font_pins.append(
                {"filename": path.name, "sha256": sha256(raw), "bytes": len(raw)}
            )
    parser = (
        MarkdownIt("commonmark", {"html": False, "linkify": True, "typographer": False})
        .enable("table")
        .enable("linkify")
    )
    tokens = parser.parse(source_text)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    page_size = {"a3": A3, "a4": A4, "letter": LETTER}[args.page_size]
    if args.orientation == "landscape":
        page_size = landscape(page_size)
    margin = 31
    with tempfile.TemporaryDirectory(prefix=".dataspec-pdf-", dir=args.output.parent) as directory:
        temporary = Path(directory)
        fonts = EmbeddedFonts(args, temporary)
        fonts.preflight(source_text)
        # SimpleDocTemplate's Frame adds its own 6-point padding on both sides.
        # Match the usable width instead of allowing tables to overrun by 12 pt.
        renderer = FullMarkdownRenderer(tokens, fonts, page_size[0] - 2 * margin - 12, args)
        story = renderer.render()
        # A source row may span pages. PDF extraction can interleave a repeated
        # table header or another column inside a wrapped hash even when every
        # glyph is present. Retain the complete body, and add a visible audit
        # index whose short physical rows never split a SHA256 across pages.
        displayed_hashes = sorted(
            set(re.findall(r"\b[a-f0-9]{64}\b", "\n".join(renderer.visible_text)))
        )
        source_hashes = sorted(
            set(re.findall(r"[a-f0-9]{64}", source_text)) | set(displayed_hashes)
        )
        columns = 2 if renderer.width >= 600 else 1
        column_width = renderer.width / columns
        widest = max(
            (pdfmetrics.stringWidth(value, fonts.regular, 1) for value in source_hashes), default=1
        )
        index_font_size = min(8.2, (column_width - 16) / widest)
        index_style = ParagraphStyle(
            "SHA256Audit",
            parent=renderer.styles["cell"],
            fontSize=index_font_size,
            leading=index_font_size * 1.45,
            splitLongWords=0,
            keepWithNext=False,
        )
        hash_cells = [Paragraph(fonts.markup(value), index_style) for value in source_hashes]
        hash_rows = [
            hash_cells[index : index + columns] for index in range(0, len(hash_cells), columns)
        ]
        if hash_rows and len(hash_rows[-1]) < columns:
            hash_rows[-1].append("")
        index_heading = Paragraph(
            fonts.markup("Audit appendix - unique source SHA256 values", True),
            renderer.styles["h1"],
        )
        index_heading._data_spec_heading = (
            "audit-source-sha256",
            "Audit appendix - unique source SHA256 values",
            0,
        )
        story.extend(
            [
                PageBreak(),
                index_heading,
                Paragraph(
                    fonts.markup(
                        f"{len(source_hashes):,} unique 64-character SHA256 strings from the unchanged source. This index supplements the complete body; it does not replace source rows or indicate new observations."
                    ),
                    renderer.styles["body"],
                ),
            ]
        )
        if hash_rows:
            hash_table = LongTable(
                hash_rows,
                colWidths=[column_width] * columns,
                hAlign="LEFT",
                splitByRow=1,
                splitInRow=0,
            )
            hash_table.setStyle(
                TableStyle(
                    [
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                        ("TOPPADDING", (0, 0), (-1, -1), 2),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ]
                )
            )
            story.append(hash_table)
        title = "Planet X / SPHEREx - Data Specification"
        cover = [
            Paragraph(fonts.markup(title, True), renderer.styles["h1"]),
            Paragraph(
                fonts.markup(f"Version {args.version} | Built {built_at}"), renderer.styles["body"]
            ),
            Paragraph(
                fonts.markup(f"Source: {args.source.name} | {len(source_raw):,} bytes"),
                renderer.styles["body"],
            ),
            Paragraph(fonts.markup("Source SHA256: " + source_hash), renderer.styles["body"]),
            Paragraph(
                fonts.markup(
                    "Complete source document, including historical snapshots, replaced datasets and scientific limits. The source text is not summarized or updated by PDF conversion."
                ),
                renderer.styles["body"],
            ),
            Paragraph(
                fonts.markup(
                    "HTTP(S) source links are clickable. Local archive paths remain local references. The unchanged source Markdown and font license are attached to this PDF."
                ),
                renderer.styles["body"],
            ),
            Spacer(1, 12),
            Paragraph(
                fonts.markup(
                    "Font license: SIL Open Font License 1.1. Source provenance, build dependencies and final PDF hash are recorded in the separate build manifest."
                ),
                renderer.styles["body"],
            ),
            PageBreak(),
        ]

        class SourceDocument(SimpleDocTemplate):
            last_outline_level = -1

            def afterFlowable(self, flowable: Any) -> None:
                if hasattr(flowable, "_data_spec_heading"):
                    anchor, text, level = flowable._data_spec_heading
                    level = min(level, self.last_outline_level + 1)
                    self.canv.bookmarkPage(anchor)
                    self.canv.addOutlineEntry(text, anchor, level=level, closed=level > 0)
                    self.last_outline_level = level

        def page_decoration(canvas: Any, document: Any) -> None:
            canvas.saveState()
            canvas.setStrokeColor(colors.HexColor("#ced6df"))
            canvas.line(margin, 24, page_size[0] - margin, 24)
            canvas.setFont(fonts.regular, 6.7)
            canvas.setFillColor(colors.HexColor("#526476"))
            canvas.drawString(
                margin, 15, f"Planet X / SPHEREx | v{args.version} | source {source_hash[:16]}"
            )
            canvas.drawRightString(page_size[0] - margin, 15, f"{built_at} | Page {document.page}")
            canvas.restoreState()

        raw_pdf = temporary / "layout.pdf"
        document = SourceDocument(
            str(raw_pdf),
            pagesize=page_size,
            leftMargin=margin,
            rightMargin=margin,
            topMargin=27,
            bottomMargin=34,
            title=title,
            author="Planet X team",
            allowSplitting=1,
            pageCompression=1,
        )

        def make_canvas(*values: Any, **options: Any) -> Any:
            options["invariant"] = 1
            return canvas_module.Canvas(*values, **options)

        document.build(
            cover + story,
            onFirstPage=page_decoration,
            onLaterPages=page_decoration,
            canvasmaker=make_canvas,
        )
        failed_pdf = Path("tmp/pdfs") / (
            f"failed-{args.output.stem}-{stamp.strftime('%Y%m%dT%H%M%SZ')}-{source_hash[:12]}.pdf"
        )
        # Retain a readable layout even if later attachment/text audits fail.
        # Successful publication removes this diagnostic copy below.
        atomic_write(failed_pdf, raw_pdf.read_bytes())
        writer = PdfWriter()
        writer.clone_document_from_reader(PdfReader(raw_pdf))
        pdf_date = stamp.strftime("D:%Y%m%d%H%M%S+00'00'")
        writer.add_metadata(
            {
                "/Title": title,
                "/Author": "Planet X team",
                "/Creator": ALGORITHM,
                "/Subject": f"Complete {args.source.name}; source SHA256 {source_hash}",
                "/Keywords": "Planet X, SPHEREx, data provenance, historical records, source manifest",
                "/CreationDate": pdf_date,
                "/ModDate": pdf_date,
                "/DataSpecSourceSHA256": source_hash,
                "/DataSpecBuiltAtUTC": built_at,
                "/DataSpecVersion": args.version,
            }
        )
        writer.add_attachment(args.source.name, source_raw)
        writer.add_attachment("DocumentFont-OFL.txt", license_raw)
        for license_record, raw_license in fallback_licenses:
            writer.add_attachment(license_record["attachment_filename"], raw_license)
        finished_pdf = temporary / "finished.pdf"
        with finished_pdf.open("wb") as output:
            writer.write(output)
        atomic_write(failed_pdf, finished_pdf.read_bytes())
        reader = PdfReader(finished_pdf)
        attachments = reader.attachments[args.source.name]
        if source_raw not in attachments:
            raise ValueError("Embedded source Markdown differs from the unmodified input")
        expected_licenses = [
            ("DocumentFont-OFL.txt", license_raw),
            *[(record["attachment_filename"], raw) for record, raw in fallback_licenses],
        ]
        for attachment_name, expected_license in expected_licenses:
            if expected_license not in reader.attachments[attachment_name]:
                raise ValueError(
                    f"Embedded font license differs from its source: {attachment_name}"
                )
        extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
        normalized = compact(extracted)
        missing_hashes = [value for value in source_hashes if value not in normalized]
        missing_headings = [
            text for _, text in renderer.heading_names.values() if compact(text) not in normalized
        ]
        if missing_hashes or missing_headings:
            raise ValueError(
                f"PDF text audit failed: missing hashes={missing_hashes[:8]}, headings={missing_headings[:8]}"
            )
        uri_annotations = 0
        retained_urls: set[str] = set()
        for page in reader.pages:
            for annotation in page.get("/Annots", []):
                action = annotation.get_object().get("/A")
                action = action.get_object() if action else None
                if action and action.get("/S") == "/URI":
                    uri_annotations += 1
                    retained_urls.add(str(action.get("/URI", "")))
        if renderer.links and uri_annotations == 0:
            raise ValueError("Source hyperlinks were not preserved as PDF URI annotations")
        missing_urls = sorted(set(renderer.links) - retained_urls)
        if missing_urls:
            raise ValueError(f"PDF hyperlinks were lost during layout: {missing_urls[:8]}")
        if args.source.read_bytes() != source_raw:
            raise ValueError("Data_Spec changed during generation; freeze source and rebuild")
        pdf_raw = finished_pdf.read_bytes()
        versions = {
            name: importlib.metadata.version(name)
            for name in ["reportlab", "markdown-it-py", "linkify-it-py", "fonttools", "pypdf"]
        }
        manifest = {
            "schema_version": "1.0",
            "algorithm_version": ALGORITHM,
            "version": args.version,
            "built_at": built_at,
            "source_filename": args.source.name,
            "source_bytes": len(source_raw),
            "source_sha256": source_hash,
            "pdf_filename": args.output.name,
            "pdf_bytes": len(pdf_raw),
            "pdf_sha256": sha256(pdf_raw),
            "pages": len(reader.pages),
            "source_lines": len(source_text.splitlines()),
            "markdown_block_tokens": len(tokens),
            "rendered": dict(renderer.metrics),
            "visible_source_sha256_audit_index_count": len(source_hashes),
            "page_size": args.page_size,
            "orientation": args.orientation,
            "layout": {
                "word_wrap": "LTR",
                "split_long_words": True,
                "table_split_in_row": True,
                "frame_side_padding_pt": 6,
            },
            "fonts": fonts.records,
            "font_license_sha256": sha256(license_raw),
            "font_license_bytes": len(license_raw),
            "fallback_font_licenses": [record for record, _ in fallback_licenses],
            "font_provenance": font_provenance,
            "verified_font_source_pins": verified_font_pins,
            "dependencies": versions,
            "python": sys.version.split()[0],
            "script_sha256": sha256(Path(__file__).read_bytes()),
            "http_source_links": dict(renderer.links),
            "local_file_references_not_public_urls": dict(renderer.local_links),
            "pdf_uri_annotations": uri_annotations,
            "validation": {
                "source_embedded_byte_identical": True,
                "font_glyph_preflight": "passed",
                "displayed_unique_sha256_count": len(displayed_hashes),
                "all_unique_source_sha256_indexed_and_extracted": True,
                "missing_displayed_hashes": [],
                "all_http_source_link_targets_retained": True,
                "all_source_headings_extracted": True,
                "source_unchanged_during_build": True,
                "visual_render_review": "required_separate_operator_step_not_claimed",
            },
            "limits": [
                "No source freshness, new astronomical measurement or scientific accuracy is established by PDF conversion.",
                "Historical source records and removed-feature inventories are retained exactly as documented.",
                "Original font and license hashes are local input checks; upstream retrieval proof is supplied separately.",
                "The PDF's own hash is only in this separate manifest, not embedded recursively in the PDF.",
            ],
        }
        atomic_write(args.output, pdf_raw)
        atomic_write(args.source_copy or args.output.with_suffix(".source.md"), source_raw)
        atomic_write(
            args.manifest or args.output.with_suffix(".manifest.json"),
            (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
        )
        failed_pdf.unlink(missing_ok=True)
        return manifest


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--font",
        type=Path,
        required=True,
        help="Official OFL TrueType font; variable wght is instantiated at 400/700",
    )
    parser.add_argument("--font-bold", type=Path)
    parser.add_argument("--fallback-font", type=Path, action="append", default=[])
    parser.add_argument(
        "--fallback-font-license",
        type=Path,
        action="append",
        default=[],
        help="Required once per --fallback-font, in the same order; separately pinned and embedded",
    )
    parser.add_argument("--font-license", type=Path, help="Defaults to OFL.txt beside --font")
    parser.add_argument(
        "--font-provenance", type=Path, help="Defaults to font-source.json beside --font"
    )
    parser.add_argument(
        "--built-at", required=True, help="Exact ISO8601 UTC build stamp, including Z or +00:00"
    )
    parser.add_argument("--version", required=True)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--source-copy", type=Path)
    parser.add_argument("--page-size", choices=["a3", "a4", "letter"], default="a4")
    parser.add_argument("--orientation", choices=["landscape", "portrait"], default="landscape")
    parser.add_argument("--table-font-size", type=float, default=7.2)
    args = parser.parse_args()
    if not 6.5 <= args.table_font_size <= 12:
        parser.error("--table-font-size must be between 6.5 and 12 points")
    paths = [
        args.output,
        args.manifest or args.output.with_suffix(".manifest.json"),
        args.source_copy or args.output.with_suffix(".source.md"),
    ]
    if (
        any(path.resolve() == args.source.resolve() for path in paths)
        or len({path.resolve() for path in paths}) != 3
    ):
        parser.error(
            "Output PDF/manifest/source-copy paths must be distinct and must not overwrite --source"
        )
    result = build(args)
    print(
        json.dumps(
            {
                key: result[key]
                for key in [
                    "version",
                    "source_sha256",
                    "pdf_sha256",
                    "built_at",
                    "pages",
                    "pdf_bytes",
                ]
            }
        )
    )


if __name__ == "__main__":
    main()
