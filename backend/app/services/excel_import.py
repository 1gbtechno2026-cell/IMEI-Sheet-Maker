"""Excel/CSV parsing and column auto-detection for invoicing."""

from __future__ import annotations

from io import BytesIO
from typing import Any

import pandas as pd

MODEL_ALIASES = {
    "model",
    "model no",
    "model no.",
    "model_no",
    "modelno",
    "model number",
    "model name",
    "modal",
    "modal no",
    "modal no.",
    "modal name",
    "item",
    "sku",
}
SERIAL_ALIASES = {
    "serial",
    "serial no",
    "serial no.",
    "serial number",
    "s.no",
    "s no",
    "sno",
    "sr",
    "sr no",
    "sr. no",
    "sr no.",
    "sr.no",
}
IMEI_ALIASES = {
    "imei",
    "imei no",
    "imei no.",
    "imei_no",
    "imeino",
    "imei number",
    "serial",
    "serial no",
}
BOX_ALIASES = {
    "box",
    "box no",
    "box no.",
    "box_no",
    "boxno",
    "carton",
    "carton no",
    "carton_no",
}
COUNTRY_ALIASES = {
    "country",
    "country of origin",
    "origin",
    "coo",
}


def _norm_header(value: Any) -> str:
    return str(value or "").strip().lower().replace("_", " ")


def detect_columns(headers: list[str], invoice_type: str) -> dict[str, str | None]:
    normalized = {_norm_header(h): h for h in headers if str(h).strip() != ""}
    mapping: dict[str, str | None] = {
        "model_no": None,
        "imei": None,
        "box_no": None,
        "country_of_origin": None,
    }

    for alias in MODEL_ALIASES:
        if alias in normalized:
            mapping["model_no"] = normalized[alias]
            break
    for alias in IMEI_ALIASES:
        if alias in normalized:
            mapping["imei"] = normalized[alias]
            break
    for alias in BOX_ALIASES:
        if alias in normalized:
            mapping["box_no"] = normalized[alias]
            break
    for alias in COUNTRY_ALIASES:
        if alias in normalized:
            mapping["country_of_origin"] = normalized[alias]
            break
    return mapping


def _cell_str(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    if isinstance(value, bool):
        return ""
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        # Avoid 15-digit IMEI becoming scientific notation
        if value.is_integer():
            return str(int(value))
        return str(value).strip()
    text = str(value).strip()
    if text.lower() in {"nan", "none", "<na>"}:
        return ""
    # Excel/pandas sometimes stringifies whole-number IMEIs as "3512….0" or "3.51e+14"
    if len(text) > 2 and text.endswith(".0") and text[:-2].isdigit():
        return text[:-2]
    compact = text.replace(",", "")
    if compact[:1].isdigit() and ("e" in compact.lower()):
        try:
            num = float(compact)
        except ValueError:
            return text
        if num.is_integer():
            return str(int(num))
    return text


def read_tabular(data: bytes, filename: str) -> pd.DataFrame:
    name = (filename or "").lower()
    bio = BytesIO(data)
    if name.endswith(".csv"):
        # dtype=str keeps IMEI intact
        return pd.read_csv(bio, dtype=str, keep_default_na=False)
    if name.endswith((".xlsx", ".xlsm", ".xls")):
        return pd.read_excel(bio, dtype=str, engine="openpyxl")
    # Try excel then csv
    try:
        bio.seek(0)
        return pd.read_excel(bio, dtype=str, engine="openpyxl")
    except Exception:
        bio.seek(0)
        return pd.read_csv(bio, dtype=str, keep_default_na=False)


_NOT_MODEL_HEADERS = BOX_ALIASES | IMEI_ALIASES | MODEL_ALIASES | {
    "s.no",
    "s no",
    "sno",
    "sr",
    "sr no",
    "sr. no",
    "sr no.",
    "qty",
    "quantity",
    "rate",
    "amount",
    "price",
    "description",
    "particulars",
}


def _is_box_header(value: str) -> bool:
    name = _norm_header(value)
    return bool(name) and (name in BOX_ALIASES or name.startswith("box"))


def _is_model_header(value: str) -> bool:
    raw = str(value or "").strip()
    if len(raw) < 3:
        return False
    if _norm_header(raw) in _NOT_MODEL_HEADERS:
        return False
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) >= 14:
        return False
    return not raw.replace(".", "", 1).isdigit()


def _pairs_from_headers(headers: list[str]) -> list[tuple[int | None, int, str]]:
    """Box column + model column pairs. Model column header is the product name."""
    named = [h for h in headers if h]
    detected = detect_columns(named, "INTERNATIONAL")
    # Ordinary Model | IMEI | Box sheets stay on the flat parser.
    if detected["model_no"] and detected["imei"]:
        return []

    pairs: list[tuple[int | None, int, str]] = []
    index = 0
    total = len(headers)
    while index < total:
        header = headers[index]
        nxt = headers[index + 1] if index + 1 < total else ""
        if _is_box_header(header) and _is_model_header(nxt):
            pairs.append((index, index + 1, nxt.strip()))
            index += 2
            continue
        if _is_model_header(header):
            pairs.append((None, index, header.strip()))
            index += 1
            continue
        index += 1
    return pairs


def _column_looks_like_imeis(grid: pd.DataFrame, col: int, start_row: int) -> bool:
    seen = 0
    imei_like = 0
    for row_index in range(start_row, grid.shape[0]):
        text = _cell_str(grid.iat[row_index, col])
        if not text:
            continue
        seen += 1
        digits = "".join(ch for ch in text if ch.isdigit())
        if len(digits) >= 14:
            imei_like += 1
        if seen >= 6 and imei_like >= 3:
            return True
    return imei_like >= 1 and imei_like * 2 >= seen


def _read_grid(data: bytes, filename: str) -> pd.DataFrame:
    """Read a sheet without promoting the first row to column names."""
    name = (filename or "").lower()
    bio = BytesIO(data)
    if name.endswith(".csv"):
        return pd.read_csv(bio, dtype=str, header=None, keep_default_na=False)
    if name.endswith((".xlsx", ".xlsm", ".xls")):
        return pd.read_excel(bio, dtype=str, header=None, engine="openpyxl")
    try:
        bio.seek(0)
        return pd.read_excel(bio, dtype=str, header=None, engine="openpyxl")
    except Exception:
        bio.seek(0)
        return pd.read_csv(bio, dtype=str, header=None, keep_default_na=False)


def _try_parse_packed(data: bytes, filename: str, invoice_type: str) -> dict[str, Any] | None:
    """Packing sheet: Box No | MODEL NAME | Box No | MODEL NAME, IMEIs under each model.

    Box number is filled down until the next box number in that column.
    """
    grid = _read_grid(data, filename)
    if grid.empty or grid.shape[0] < 2:
        return None

    candidates: list[tuple[int, int, int, list[tuple[int | None, int, str]]]] = []
    scan = min(8, grid.shape[0])
    for row_index in range(scan):
        headers = [_cell_str(grid.iat[row_index, col]) for col in range(grid.shape[1])]
        found = _pairs_from_headers(headers)
        found = [pair for pair in found if _column_looks_like_imeis(grid, pair[1], row_index + 1)]
        if not found:
            continue
        # Box + model pairs beat a title sitting in a column of IMEIs.
        score = sum(2 if pair[0] is not None else 1 for pair in found)
        first_is_imei = 0
        for _box_col, model_col, _name in found:
            for data_row in range(row_index + 1, grid.shape[0]):
                text = _cell_str(grid.iat[data_row, model_col])
                if not text:
                    continue
                digits = "".join(ch for ch in text if ch.isdigit())
                if len(digits) >= 14:
                    first_is_imei = 1
                break
            if first_is_imei:
                break
        candidates.append((score, first_is_imei, -row_index, found))
    if not candidates:
        return None
    _score, _imei_first, neg_row, pairs = max(candidates)
    header_row = -neg_row

    rows: list[dict[str, Any]] = []
    box_state = [""] * len(pairs)
    for row_index in range(header_row + 1, grid.shape[0]):
        for pair_index, (box_col, model_col, model_name) in enumerate(pairs):
            if box_col is not None:
                box_value = _cell_str(grid.iat[row_index, box_col])
                if box_value:
                    box_state[pair_index] = box_value
            imei = _cell_str(grid.iat[row_index, model_col])
            if not imei:
                continue
            digits = "".join(ch for ch in imei if ch.isdigit())
            if len(digits) < 14:
                continue
            rows.append(
                {
                    "row_index": row_index + 1,
                    "model_no": model_name,
                    "imei": imei,
                    "box_no": box_state[pair_index] or None,
                    "country_of_origin": None,
                }
            )

    if not rows:
        return None

    headers = [_cell_str(grid.iat[header_row, col]) for col in range(grid.shape[1])]
    headers = [h if h else f"Column {i + 1}" for i, h in enumerate(headers)]
    has_box = any(pair[0] is not None for pair in pairs)
    detected = {
        "model_no": pairs[0][2],
        "imei": pairs[0][2],
        "box_no": "Box No" if has_box else None,
    }
    return {
        "headers": headers,
        "detected_map": detected,
        "effective_map": dict(detected),
        "needs_manual_map": False,
        "rows": rows,
        "row_count": len(rows),
        "source_file_name": filename,
    }


def _header_role(value: str) -> str | None:
    name = _norm_header(value)
    if not name:
        return None
    # "Serial No" is the running number in a 4-column block, not the IMEI.
    if name in SERIAL_ALIASES or name.startswith("serial") or name.startswith("sr"):
        return "serial"
    if name in IMEI_ALIASES or name.startswith("imei"):
        return "imei"
    if name in BOX_ALIASES or name.startswith("box"):
        return "box"
    if name in COUNTRY_ALIASES or name.startswith("country"):
        return "country"
    if name in MODEL_ALIASES or "model" in name or "modal" in name:
        return "model"
    return None


def _named_group(headers: list[str], index: int, width: int, expected: set[str]) -> dict[str, Any] | None:
    if index + width > len(headers):
        return None
    roles = [_header_role(headers[index + offset]) for offset in range(width)]
    if any(role is None for role in roles):
        return None
    if set(roles) != expected or len(roles) != len(expected):
        return None
    return {role: index + roles.index(role) for role in roles}


def _column_groups(headers: list[str]) -> list[dict[str, Any]]:
    """Repeating model blocks for the local and international templates."""
    groups: list[dict[str, Any]] = []
    index = 0
    total = len(headers)
    while index < total:
        # International template: Box No | MODEL NAME | Country of Origin.
        # The model name is the header; the cells under it are that model's IMEIs.
        if index + 2 < total:
            model_header = headers[index + 1]
            if (
                _header_role(headers[index]) == "box"
                and _header_role(model_header) is None
                and _is_model_header(model_header)
                and _header_role(headers[index + 2]) == "country"
            ):
                groups.append(
                    {
                        "serial": None,
                        "box": index,
                        "model": None,
                        "imei": index + 1,
                        "country": index + 2,
                        "model_name": model_header.strip(),
                    }
                )
                index += 3
                continue
        # Local template: the column header is the model name, and the cells are IMEIs.
        if _header_role(headers[index]) is None and _is_model_header(headers[index]):
            groups.append(
                {
                    "serial": None,
                    "box": None,
                    "model": None,
                    "imei": index,
                    "country": None,
                    "model_name": headers[index].strip(),
                }
            )
            index += 1
            continue
        international = _named_group(
            headers, index, 5, {"serial", "box", "model", "imei", "country"}
        )
        if international:
            groups.append(
                {
                    "serial": international["serial"],
                    "box": international["box"],
                    "model": international["model"],
                    "imei": international["imei"],
                    "country": international["country"],
                    "model_name": None,
                }
            )
            index += 5
            continue
        with_box = _named_group(headers, index, 4, {"serial", "box", "model", "imei"})
        if with_box:
            groups.append(
                {
                    "serial": with_box["serial"],
                    "box": with_box["box"],
                    "model": with_box["model"],
                    "imei": with_box["imei"],
                    "country": None,
                    "model_name": None,
                }
            )
            index += 4
            continue
        if index + 3 < total:
            model_header = headers[index + 2]
            if (
                _header_role(headers[index]) == "serial"
                and _header_role(headers[index + 1]) == "box"
                and _header_role(model_header) is None
                and _is_model_header(model_header)
                and _header_role(headers[index + 3]) == "country"
            ):
                groups.append(
                    {
                        "serial": index,
                        "box": index + 1,
                        "model": None,
                        "imei": index + 2,
                        "country": index + 3,
                        "model_name": model_header.strip(),
                    }
                )
                index += 4
                continue
        local = _named_group(headers, index, 3, {"serial", "model", "imei"})
        if local:
            groups.append(
                {
                    "serial": local["serial"],
                    "box": None,
                    "model": local["model"],
                    "imei": local["imei"],
                    "country": None,
                    "model_name": None,
                }
            )
            index += 3
            continue
        if index + 2 < total:
            third = headers[index + 2]
            if (
                _header_role(headers[index]) == "serial"
                and _header_role(headers[index + 1]) == "box"
                and _header_role(third) is None
                and _is_model_header(third)
            ):
                groups.append(
                    {
                        "serial": index,
                        "box": index + 1,
                        "model": None,
                        "imei": index + 2,
                        "country": None,
                        "model_name": third.strip(),
                    }
                )
                index += 3
                continue
        if index + 1 < total:
            model_header = headers[index + 1]
            if (
                _header_role(headers[index]) == "serial"
                and _header_role(model_header) is None
                and _is_model_header(model_header)
            ):
                groups.append(
                    {
                        "serial": index,
                        "box": None,
                        "model": None,
                        "imei": index + 1,
                        "country": None,
                        "model_name": model_header.strip(),
                    }
                )
                index += 2
                continue
        index += 1
    return groups


def _try_parse_column_groups(data: bytes, filename: str, invoice_type: str) -> dict[str, Any] | None:
    """One model per column block, repeated across the sheet."""
    grid = _read_grid(data, filename)
    if grid.empty or grid.shape[0] < 2:
        return None

    header_row = None
    groups: list[dict[str, Any]] = []
    scan = min(8, grid.shape[0])
    for row_index in range(scan):
        headers = [_cell_str(grid.iat[row_index, col]) for col in range(grid.shape[1])]
        found = _column_groups(headers)
        found = [group for group in found if _column_looks_like_imeis(grid, group["imei"], row_index + 1)]
        if found:
            header_row = row_index
            groups = found
            break
    if header_row is None or not groups:
        return None

    rows: list[dict[str, Any]] = []
    for group in groups:
        fixed_name = str(group.get("model_name") or "")
        model_state = fixed_name
        box_state = ""
        country_state = ""
        model_col = group.get("model")
        box_col = group.get("box")
        country_col = group.get("country")
        serial = 0
        for row_index in range(header_row + 1, grid.shape[0]):
            if not fixed_name and model_col is not None:
                model_cell = _cell_str(grid.iat[row_index, model_col])
                if model_cell:
                    model_state = model_cell
            if box_col is not None:
                box_cell = _cell_str(grid.iat[row_index, box_col])
                if box_cell:
                    box_state = box_cell
            if country_col is not None:
                country_cell = _cell_str(grid.iat[row_index, country_col])
                if country_cell:
                    country_state = country_cell
            imei = _cell_str(grid.iat[row_index, group["imei"]])
            if not imei:
                continue
            digits = "".join(ch for ch in imei if ch.isdigit())
            if len(digits) < 14:
                continue
            serial += 1
            rows.append(
                {
                    "row_index": serial,
                    "model_no": model_state,
                    "imei": imei,
                    "box_no": box_state or None,
                    "country_of_origin": country_state or None,
                }
            )

    if not rows:
        return None

    headers = [_cell_str(grid.iat[header_row, col]) for col in range(grid.shape[1])]
    headers = [h if h else f"Column {i + 1}" for i, h in enumerate(headers)]
    detected = {
        "model_no": "Modal",
        "imei": "IMEI NO",
        "box_no": "Box No",
    }
    return {
        "headers": headers,
        "detected_map": detected,
        "effective_map": dict(detected),
        "needs_manual_map": False,
        "rows": rows,
        "row_count": len(rows),
        "source_file_name": filename,
    }


class SheetCountError(ValueError):
    """An IMEI data sheet whose IMEIs do not match its own summary."""


def _try_parse_data_sheet(data: bytes, filename: str, invoice_type: str) -> dict[str, Any] | None:
    """The one-sheet layout from Step 3: title, summary, then the IMEI data blocks."""
    from app.services.excel_export import DATA_MARKER, SHEET_TITLE, SUMMARY_MARKER

    grid = _read_grid(data, filename)
    if grid.empty or grid.shape[1] == 0:
        return None
    first_col = [_cell_str(grid.iat[r, 0]) for r in range(grid.shape[0])]
    if not any(text.upper() == SHEET_TITLE for text in first_col[:3]):
        return None

    def find(label: str, start: int = 0) -> int | None:
        for index in range(start, len(first_col)):
            if first_col[index].upper() == label:
                return index
        return None

    data_marker = find(DATA_MARKER)
    if data_marker is None or data_marker + 1 >= grid.shape[0]:
        raise SheetCountError("The IMEI DATA section is missing from this sheet.")

    for index in range(data_marker):
        if _norm_header(first_col[index]) == "type":
            sheet_type = _cell_str(grid.iat[index, 1]).upper() if grid.shape[1] > 1 else ""
            wanted = "INTERNATIONAL" if invoice_type == "INTERNATIONAL" else "LOCAL"
            if sheet_type in {"LOCAL", "INTERNATIONAL"} and sheet_type != wanted:
                raise SheetCountError(
                    f"This sheet was made for {sheet_type.title()}. Switch to {sheet_type.title()} "
                    f"at the top of the page, or make a new template in {wanted.title()} mode."
                )
            break

    # Expected quantity per model, from the summary table.
    expected: dict[str, int] = {}
    summary_at = find(SUMMARY_MARKER)
    if summary_at is not None and summary_at < data_marker:
        head = [_norm_header(_cell_str(grid.iat[summary_at + 1, c])) for c in range(grid.shape[1])]
        if "model" in head and "quantity" in head:
            model_col, qty_col = head.index("model"), head.index("quantity")
            for index in range(summary_at + 2, data_marker):
                name = _cell_str(grid.iat[index, model_col])
                if not name or name.lower() == "total":
                    break
                qty = _cell_str(grid.iat[index, qty_col])
                if qty.isdigit():
                    expected[name] = int(qty)

    header_row = data_marker + 1
    headers = [_cell_str(grid.iat[header_row, c]) for c in range(grid.shape[1])]
    blocks: list[dict[str, Any]] = []
    pending_box: int | None = None
    for col, header in enumerate(headers):
        name = _norm_header(header)
        if not name:
            pending_box = None
        elif name in BOX_ALIASES:
            pending_box = col
        elif name in COUNTRY_ALIASES and blocks:
            blocks[-1]["country"] = col
        else:
            blocks.append({"name": header.strip(), "imei": col, "box": pending_box, "country": None})
            pending_box = None

    rows: list[dict[str, Any]] = []
    found: dict[str, int] = {}
    for block in blocks:
        box_state = ""
        country_state = ""
        for index in range(header_row + 1, grid.shape[0]):
            if block["box"] is not None:
                box_state = _cell_str(grid.iat[index, block["box"]]) or box_state
            if block["country"] is not None:
                country_state = _cell_str(grid.iat[index, block["country"]]) or country_state
            imei = _cell_str(grid.iat[index, block["imei"]])
            if not imei:
                continue
            found[block["name"]] = found.get(block["name"], 0) + 1
            rows.append(
                {
                    "row_index": index + 1,
                    "model_no": block["name"],
                    "imei": imei,
                    "box_no": box_state or None,
                    "country_of_origin": (country_state or None) if invoice_type == "INTERNATIONAL" else None,
                }
            )

    problems = [
        f"{name}: summary says {count}, sheet has {found.get(name, 0)}"
        for name, count in expected.items()
        if found.get(name, 0) != count
    ]
    problems += [f"{name}: not in the summary" for name in found if expected and name not in expected]
    if problems:
        raise SheetCountError("IMEI count does not match the summary. " + "; ".join(problems))
    if not rows:
        raise SheetCountError("No IMEIs found. Fill the yellow cells under each model, then upload again.")

    return {
        "headers": headers,
        "detected_map": {"model_no": "Model", "imei": "IMEI", "box_no": "Box No"},
        "effective_map": {"model_no": "Model", "imei": "IMEI", "box_no": "Box No"},
        "needs_manual_map": False,
        "rows": rows,
        "row_count": len(rows),
        "source_file_name": filename,
        "sheet_summary": [
            {"model_no": name, "quantity": found.get(name, 0)} for name in (expected or found)
        ],
    }


def parse_rows(
    data: bytes,
    filename: str,
    invoice_type: str,
    column_map: dict[str, str] | None = None,
) -> dict[str, Any]:
    # Packing-sheet layout (model name is the column header). Manual column
    # mapping always uses the flat Model | IMEI | Box parser below.
    if not column_map:
        # Step 3 template keeps its box numbers in Local too.
        data_sheet = _try_parse_data_sheet(data, filename, invoice_type)
        if data_sheet is not None:
            return data_sheet
        grouped = _try_parse_column_groups(data, filename, invoice_type)
        if grouped is not None:
            return _apply_invoice_mode(grouped, invoice_type)
        packed = _try_parse_packed(data, filename, invoice_type)
        if packed is not None:
            return _apply_invoice_mode(packed, invoice_type)

    df = read_tabular(data, filename)
    if df.empty:
        return {
            "headers": [],
            "detected_map": {
                "model_no": None,
                "imei": None,
                "box_no": None,
                "country_of_origin": None,
            },
            "needs_manual_map": True,
            "rows": [],
            "row_count": 0,
            "source_file_name": filename,
        }

    headers = [str(c) for c in df.columns.tolist()]
    detected = detect_columns(headers, invoice_type)
    effective = {
        "model_no": (column_map or {}).get("model_no") or detected["model_no"],
        "imei": (column_map or {}).get("imei") or detected["imei"],
        "box_no": (column_map or {}).get("box_no") or detected["box_no"],
        "country_of_origin": (column_map or {}).get("country_of_origin")
        or detected.get("country_of_origin"),
    }

    needs_manual = not effective["model_no"] or not effective["imei"]
    if invoice_type == "INTERNATIONAL" and not effective["box_no"]:
        # Box is required for international — flag manual if missing
        needs_manual = True

    rows: list[dict[str, Any]] = []
    if not needs_manual:
        for idx, series in df.iterrows():
            model = _cell_str(series.get(effective["model_no"]))
            imei = _cell_str(series.get(effective["imei"]))
            box = (
                _cell_str(series.get(effective["box_no"]))
                if effective["box_no"]
                else ""
            )
            country = (
                _cell_str(series.get(effective["country_of_origin"]))
                if effective.get("country_of_origin")
                else ""
            )
            # Skip completely empty lines
            if not model and not imei and not box and not country:
                continue
            rows.append(
                {
                    "row_index": int(idx) + 2,  # spreadsheet-ish (header=1)
                    "model_no": model,
                    "imei": imei,
                    "box_no": box or None,
                    "country_of_origin": country or None,
                }
            )

    result = {
        "headers": headers,
        "detected_map": detected,
        "effective_map": effective,
        "needs_manual_map": needs_manual,
        "rows": rows,
        "row_count": len(rows),
        "source_file_name": filename,
    }
    return _apply_invoice_mode(result, invoice_type)


def _apply_invoice_mode(result: dict[str, Any], invoice_type: str) -> dict[str, Any]:
    """Local sheets do not keep a box number or a country."""
    if invoice_type == "LOCAL":
        for row in result.get("rows") or []:
            row["box_no"] = None
            row["country_of_origin"] = None
    return result
