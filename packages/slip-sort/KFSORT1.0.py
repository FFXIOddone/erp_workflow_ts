#!/usr/bin/env python3
# Kwik Fill — Sorted Stores + Blackouts + Wobbler Kit (>=10 stores) Appendix
# + Box/Envelope classification & monthly standard box selector
# (Implements: 28x2x44 / 8x8x36 / STANDARD (default 8x8x30, promptable) /
#  Padded Envelope / Padded Pack / Stay Flat Envelope, with manual-review flags)
# NOTE: Removed legacy "Envelope-Fit Stores" concept. Envelope categories are now ONLY:
#  Padded Envelope, Padded Pack, Stay Flat Envelope.

from __future__ import annotations

import os
import re
import sys
import json
import time
import traceback
import argparse
import shutil
from math import ceil
from datetime import datetime
from pathlib import Path
from collections import defaultdict, OrderedDict
from typing import Optional

import fitz  # PyMuPDF

# Tkinter is used for the GUI flow. Some Python installs (or minimal embeddable builds)
# don't include Tcl/Tk runtime files, so creating a Tk root can fail at runtime.
try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, simpledialog
    _TK_IMPORT_OK = True
except Exception:
    tk = None
    filedialog = None
    messagebox = None
    simpledialog = None
    _TK_IMPORT_OK = False


def _console_yesno(prompt: str, default: bool = False) -> bool:
    suffix = "[Y/n]" if default else "[y/N]"
    while True:
        try:
            ans = input(f"{prompt} {suffix} ").strip().lower()
        except EOFError:
            return default
        if not ans:
            return default
        if ans in ("y", "yes"):
            return True
        if ans in ("n", "no"):
            return False


def _ui_info(title: str, msg: str, parent=None):
    if _TK_IMPORT_OK and parent is not None and messagebox is not None:
        try:
            messagebox.showinfo(title, msg, parent=parent)
            return
        except Exception:
            pass
    print(f"[{title}] {msg}")


def _ui_error(title: str, msg: str, parent=None):
    if _TK_IMPORT_OK and parent is not None and messagebox is not None:
        try:
            messagebox.showerror(title, msg, parent=parent)
            return
        except Exception:
            pass
    print(f"[{title}] ERROR: {msg}")


def _ui_yesno(title: str, msg: str, parent=None, default: bool = False) -> bool:
    if _TK_IMPORT_OK and parent is not None and messagebox is not None:
        try:
            return bool(messagebox.askyesno(title, msg, parent=parent))
        except Exception:
            pass
    print(f"[{title}] {msg}")
    return _console_yesno("Proceed?", default=default)


def _ui_askstring(title: str, prompt: str, initialvalue: str = "", parent=None) -> Optional[str]:
    if _TK_IMPORT_OK and parent is not None and simpledialog is not None:
        try:
            return simpledialog.askstring(title, prompt, initialvalue=initialvalue, parent=parent)
        except Exception:
            pass
    try:
        sfx = f" [default: {initialvalue}]" if initialvalue else ""
        ans = input(f"{title}: {prompt}{sfx} ")
        ans = ans.strip()
        return ans if ans else initialvalue
    except EOFError:
        return initialvalue

# ----------------------------- DEBUG -----------------------------

# Set env KWIK_DEBUG=1 to enable, KWIK_DEBUG=0 to disable
_debug_env = os.environ.get("KWIK_DEBUG", "").strip().lower()
if _debug_env in ("1", "true", "yes"):
    DEBUG = True
elif _debug_env in ("0", "false", "no"):
    DEBUG = False
else:
    DEBUG = False  # default off
DEBUG_LOG = "kwik_debug.log"

def dbg(msg: str):
    if not DEBUG:
        return
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
    line = f"[{ts}] {msg}"
    print(line, flush=True)
    try:
        with open(DEBUG_LOG, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def dbg_ex(prefix: str = "EXCEPTION"):
    dbg(prefix + ":\n" + traceback.format_exc())

# ----------------------------- Windows foreground helpers -----------------------------

_WIN = sys.platform.startswith("win")
if _WIN:
    import ctypes
    user32 = ctypes.windll.user32
    SW_RESTORE = 9
    SW_SHOWNORMAL = 1

    def _force_foreground(win: tk.Toplevel):
        try:
            hwnd = int(win.winfo_id())
            user32.ShowWindow(hwnd, SW_RESTORE)
            user32.ShowWindow(hwnd, SW_SHOWNORMAL)
            user32.SetForegroundWindow(hwnd)
        except Exception:
            dbg_ex("_force_foreground")

# ----------------------------- Canon + constants -----------------------------

def canon(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r'\s+', ' ', s.strip())
    s = re.sub(r'^\*+|\*+$', '', s)  # trim surrounding asterisks
    return s.lower()

def _app_dir() -> Path:
    """Directory to read/write user-editable config files.

    - In PyInstaller builds, write next to the .exe.
    - In source runs, write next to this .py file.
    """
    try:
        if getattr(sys, "frozen", False):
            return Path(sys.executable).resolve().parent
    except Exception:
        pass
    return Path(__file__).resolve().parent


APP_DIR = _app_dir()

# Config files (stored next to .exe / script)
BLACKOUT_JSON = str(APP_DIR / "blackout_config.json")
BLACKOUT_SETTINGS_JSON = str(APP_DIR / "blackout_settings.json")  # enable/disable rules
SORT_ORDER_JSON = str(APP_DIR / "sort_order_config.json")  # custom sort order

# User-extensible rules (no code edits needed)
CUSTOM_RULES_JSON = str(APP_DIR / "kwik_custom_rules.json")

# Cached config to reduce file I/O in hot paths
_CUSTOM_RULES_CACHE = None
_CUSTOM_RULES_CACHE_TIME = 0
STAR_TOKEN_RE = re.compile(r"\*[^*]+\*")

def _get_star_rule_action(rules: dict, canon_token: str) -> Optional[str]:
    """Return the configured action for a canon(token). Supports legacy str values and new dict values."""
    try:
        actions = (rules or {}).get("starred_token_actions", {}) or {}
        val = actions.get(canon_token)
        if isinstance(val, str):
            return val
        if isinstance(val, dict):
            a = val.get("action")
            return a if isinstance(a, str) else None
    except Exception:
        return None
    return None

def _get_star_rule_token_text(rules: dict, canon_token: str) -> Optional[str]:
    """Return the original token text (with * *) for searching/highlighting, if saved."""
    try:
        actions = (rules or {}).get("starred_token_actions", {}) or {}
        val = actions.get(canon_token)
        if isinstance(val, dict):
            t = val.get("token")
            return t if isinstance(t, str) else None
    except Exception:
        return None
    return None

def _star_tokens_for_actions(rules: dict, wanted_actions: set) -> list:
    """Return searchable token strings for the given actions (best-effort)."""
    out = []
    try:
        actions = (rules or {}).get("starred_token_actions", {}) or {}
        for ct, val in actions.items():
            a = _get_star_rule_action(rules, ct)
            if a not in wanted_actions:
                continue
            tok = _get_star_rule_token_text(rules, ct)
            if tok:
                out.append(tok)
            else:
                # Fallback: reconstruct a readable token from canon (won't always match PDF text)
                out.append(f"*{ct}*")
    except Exception:
        dbg_ex("_star_tokens_for_actions")
    return out

def load_custom_rules(force_reload: bool = False) -> dict:
    """Load custom rules with caching to reduce file I/O in hot paths."""
    global _CUSTOM_RULES_CACHE, _CUSTOM_RULES_CACHE_TIME
    try:
        mtime = os.path.getmtime(CUSTOM_RULES_JSON) if os.path.exists(CUSTOM_RULES_JSON) else 0
    except Exception:
        mtime = 0
    if not force_reload and _CUSTOM_RULES_CACHE is not None and mtime == _CUSTOM_RULES_CACHE_TIME:
        return _CUSTOM_RULES_CACHE
    _CUSTOM_RULES_CACHE = ensure_json(CUSTOM_RULES_JSON, {
        "type_overrides": {},            # substring -> KW key (e.g. {"door decal; 24\"w x 6\"h": "door_6x30"})
        # canon(token) -> action (legacy str) OR {"action": str, "token": "*ORIGINAL*"}
        "starred_token_actions": {}
    })
    _CUSTOM_RULES_CACHE_TIME = mtime
    return _CUSTOM_RULES_CACHE


def invalidate_custom_rules_cache():
    """Force next load_custom_rules call to re-read from disk."""
    global _CUSTOM_RULES_CACHE, _CUSTOM_RULES_CACHE_TIME
    _CUSTOM_RULES_CACHE = None
    _CUSTOM_RULES_CACHE_TIME = 0


def load_sort_order_config() -> dict:
    """Load customizable sort order config."""
    default = {
        "store_type_order": [
            "Alcohol Counter + Shipper",
            "Alcohol Counter",
            "Alcohol Shipper",
            "Alcohol No Counter/Shipper",
            "Non-Alcohol Counter + Shipper",
            "Non-Alcohol Counter",
            "Non-Alcohol Shipper",
            "Non-Alcohol No Counter/Shipper",
            "Counter + Shipper", "Counter", "Shipper", "No Counter/Shipper",
            ""
        ],
        "sort_by_location": True,
        "sort_by_store_name": True
    }
    return ensure_json(SORT_ORDER_JSON, default)


def save_sort_order_config(cfg: dict):
    try:
        with open(SORT_ORDER_JSON, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=4, ensure_ascii=False)
        dbg(f"save_sort_order_config: saved")
    except Exception:
        dbg_ex("save_sort_order_config failure")


def load_blackout_settings() -> dict:
    """Load blackout enable/disable settings per rule."""
    return ensure_json(BLACKOUT_SETTINGS_JSON, {
        "enabled_rules": {},  # "sign_type|version" -> True/False
        "global_enabled": True
    })


def save_blackout_settings(cfg: dict):
    try:
        with open(BLACKOUT_SETTINGS_JSON, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=4, ensure_ascii=False)
        dbg(f"save_blackout_settings: saved")
    except Exception:
        dbg_ex("save_blackout_settings failure")

def save_custom_rules(rules: dict):
    try:
        with open(CUSTOM_RULES_JSON, "w", encoding="utf-8") as f:
            json.dump(rules, f, indent=4, ensure_ascii=False)
        invalidate_custom_rules_cache()
    except Exception:
        dbg_ex("save_custom_rules")

def _is_handled_starred_token(token: str, rules: dict) -> bool:
    ct = canon(token)
    if not ct:
        return True
    # Known kit markers
    if ct in (canon(KIT_COUNTER), canon(KIT_SHIPPER), canon(KIT_ALC), canon(KIT_NONALC)):
        return True
    # Predetermined wobblers (excluded from post-determined kit generation)
    if ct in _PREDETERMINED_WOBBLERS_CANON:
        return True
    # User rules
    try:
        return _get_star_rule_action(rules, ct) is not None
    except Exception:
        return False

def _collect_unhandled_starred_tokens(stores_with_items: list, rules: dict) -> list:
    """Return list of dicts describing unhandled *STARRED* tokens found in Sign Type / Promotion Name."""
    found = {}
    for s in stores_with_items or []:
        store_disp = (extract_store_number(s) or s.get("store_name") or "").strip()
        for it in s.get("items", []) or []:
            for field in ("type", "promo"):
                text = str(it.get(field, "") or "")
                for tok in STAR_TOKEN_RE.findall(text):
                    ct = canon(tok)
                    if _is_handled_starred_token(tok, rules):
                        continue
                    key = (ct, field)
                    if key not in found:
                        found[key] = {
                            "token": tok,
                            "canon": ct,
                            "field": field,
                            "store": store_disp,
                            "example": text,
                            "reason": "Starred text found, but not recognized as a known kit/predetermined wobbler and no custom rule exists yet. This can impact counting/boxing decisions.",
                        }
    return list(found.values())

def _prompt_add_starred_rules(root, unhandled: list, rules: dict) -> dict:
    """Interactively map starred tokens to actions and persist to CUSTOM_RULES_JSON."""
    if not unhandled:
        return rules
    actions_allowed = {
        "ignore",                 # do nothing; marks it as handled
        "banner",                 # treat token as banner indicator
        "counter_kit",            # treat token as counter kit marker
        "shipper_kit",            # treat token as shipper kit marker
        "counter_kit_ltd",        # based on counter_kit logic (limited variant)
        "shipper_kit_ltd",        # based on shipper_kit logic (limited variant)
        "predetermined_wobbler"   # treat as predetermined wobbler marker
    }
    rules = rules or load_custom_rules()
    actions = rules.get("starred_token_actions") or {}

    for entry in unhandled:
        tok = entry.get("token", "")
        ct = entry.get("canon", "")
        field = entry.get("field", "")
        store = entry.get("store", "")
        reason = entry.get("reason", "")

        prompt = (
            "Unhandled *STARRED* text detected:\n"
            f"  Token: {tok}\n"
            f"  Found in: {field}\n"
            f"  Example: {entry.get('example','')}\n"
            f"  Store: {store}\n\n"
            f"Why: {reason}\n\n"
            "Enter an action to handle it (or leave blank to skip):\n"
            "  - ignore\n"
            "  - banner\n"
            "  - counter_kit\n"
            "  - shipper_kit\n"
            "  - counter_kit_ltd (based on counter_kit)\n"
            "  - shipper_kit_ltd (based on shipper_kit)\n"
            "  - predetermined_wobbler\n"
        )

        # Keep prompting for THIS token until:
        # - user enters a valid action (we save it), OR
        # - user leaves blank / cancels (we skip it).
        while True:
            try:
                ans = _ui_askstring("Unhandled Starred Text", prompt, initialvalue="", parent=root)
            except Exception:
                dbg_ex("prompt starred rules")
                ans = None

            if not ans:
                # Explicit skip for this token.
                break

            action = ans.strip().lower()
            if action not in actions_allowed:
                _ui_error(
                    "Invalid Action",
                    f"Action '{ans}' not recognized. Allowed: {', '.join(sorted(actions_allowed))}",
                    parent=root
                )
                # show the same token prompt again
                continue

            # Store both the action and the exact token text so we can highlight/search it later.
            actions[ct] = {"action": action, "token": tok}
            break

    rules["starred_token_actions"] = actions
    save_custom_rules(rules)
    _ui_info(
        "Rules Saved",
        f"Saved handling rules to: {os.path.abspath(CUSTOM_RULES_JSON)}\n\n"
        "You can edit this file later to add/remove rules.",
        parent=root
    )

    return rules

_PREDETERMINED_WOBBLERS_CANON = {
    "shelf wobbler kit; alcohol version",
    "candy; counter kit",
    "shelf wobbler kit; non-alcohol version",
    "candy; shipper kit",
}

KIT_COUNTER = "*CANDY; COUNTER KIT*"
KIT_SHIPPER = "*CANDY; SHIPPER KIT*"
KIT_ALC     = "*Shelf Wobbler Kit; Alcohol Version*"
KIT_NONALC  = "*Shelf Wobbler Kit; Non-Alcohol Version*"

PROMO_WOBBLER_ALC_CANON    = canon("Shelf Wobbler Kit; Alcohol Version")
PROMO_WOBBLER_NONALC_CANON = canon("Shelf Wobbler Kit; Non-Alcohol Version")
TYPE_SHELF_WOBBLER_CANON   = canon("Shelf Wobbler")

HEADER_STORE_RE = re.compile(r'Store:\s?[A-Z]\d{4}')

# Default store type order (can be overridden via sort_order_config.json)
_DEFAULT_STORE_TYPE_ORDER = [
    "Alcohol Counter + Shipper",
    "Alcohol Counter",
    "Alcohol Shipper",
    "Alcohol No Counter/Shipper",
    "Non-Alcohol Counter + Shipper",
    "Non-Alcohol Counter",
    "Non-Alcohol Shipper",
    "Non-Alcohol No Counter/Shipper",
    "Counter + Shipper", "Counter", "Shipper", "No Counter/Shipper",
    ""
]

# Default tiered sort configuration
_DEFAULT_TIERED_SORT = {
    "tiers": [
        {
            "name": "Box/Envelope Category",
            "field": "box_category",  # derived from analyze_order_boxing
            "enabled": True,
            "categories": [
                {"id": "28x2x44", "label": "28×2×44 (Large Items)", "order": 1},
                {"id": "8x8x36", "label": "8×8×36 (Banner Present)", "order": 2},
                {"id": "8x8x30", "label": "8×8×30 (Standard)", "order": 3},
                {"id": "Padded Envelope", "label": "Padded Envelope", "order": 4},
                {"id": "Padded Pack", "label": "Padded Pack", "order": 5},
                {"id": "Stay Flat Envelope", "label": "Stay Flat Envelope", "order": 6},
                {"id": "Manual Review", "label": "Manual Review", "order": 99}
            ]
        },
        {
            "name": "Kit Type",
            "field": "kit_type",  # derived from is_counter/is_shipper
            "enabled": True,
            "categories": [
                {"id": "both", "label": "Counter + Shipper", "order": 1},
                {"id": "both_limited", "label": "Counter + Shipper (Limited)", "order": 2},
                {"id": "counter", "label": "Counter Only", "order": 3},
                {"id": "counter_limited", "label": "Counter Only (Limited)", "order": 4},
                {"id": "shipper", "label": "Shipper Only", "order": 5},
                {"id": "shipper_limited", "label": "Shipper Only (Limited)", "order": 6},
                {"id": "neither", "label": "No Counter/Shipper", "order": 7}
            ]
        },
        {
            "name": "Alcohol Type",
            "field": "alc_type",  # derived from is_alcohol/is_non_alcohol
            "enabled": True,
            "categories": [
                {"id": "alcohol", "label": "Alcohol", "order": 1},
                {"id": "non_alcohol", "label": "Non-Alcohol", "order": 2},
                {"id": "none", "label": "Neither", "order": 3}
            ]
        },
        {
            "name": "Location",
            "field": "location",
            "enabled": True,
            "categories": [
                {"id": "NY", "label": "New York", "order": 1},
                {"id": "PA", "label": "Pennsylvania", "order": 2},
                {"id": "OH", "label": "Ohio", "order": 3},
                {"id": "_other", "label": "Other", "order": 99}
            ]
        },
        {
            "name": "Store Name",
            "field": "store_name",
            "enabled": True,
            "categories": []  # Empty = alphabetical sort
        }
    ]
}


def load_sort_order_config() -> dict:
    """Load customizable sort order config."""
    default = {
        "store_type_order": _DEFAULT_STORE_TYPE_ORDER,
        "sort_by_location": True,
        "sort_by_store_name": True,
        "tiered_sort": _DEFAULT_TIERED_SORT,
        "use_tiered_sort": True  # New default: use tiered system
    }
    return ensure_json(SORT_ORDER_JSON, default)


def save_sort_order_config(cfg: dict):
    try:
        with open(SORT_ORDER_JSON, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=4, ensure_ascii=False)
        dbg(f"save_sort_order_config: saved")
    except Exception:
        dbg_ex("save_sort_order_config failure")


def _get_store_kit_type(store: dict) -> str:
    """Derive kit_type from store classification flags."""
    is_counter = 'Counter' in store.get('store_type', '')
    is_shipper = 'Shipper' in store.get('store_type', '')
    if is_counter and is_shipper:
        return "both"
    elif is_counter:
        return "counter"
    elif is_shipper:
        return "shipper"
    return "neither"


def _get_store_alc_type(store: dict) -> str:
    """Derive alc_type from store classification."""
    st = store.get('store_type', '')
    if 'Alcohol' in st and 'Non-Alcohol' not in st:
        return "alcohol"
    elif 'Non-Alcohol' in st:
        return "non_alcohol"
    return "none"


def _get_tiered_sort_key(store: dict, tiered_cfg: dict) -> tuple:
    """Generate a sort key tuple based on tiered configuration."""
    tiers = tiered_cfg.get("tiers", [])
    key_parts = []
    
    for tier in tiers:
        if not tier.get("enabled", True):
            continue
            
        field = tier.get("field", "")
        categories = tier.get("categories", [])
        
        # Get the value for this field
        if field == "kit_type":
            value = _get_store_kit_type(store)
        elif field == "alc_type":
            value = _get_store_alc_type(store)
        elif field == "box_category":
            value = store.get("box_category", "") or ""
        elif field == "location":
            value = store.get("location", "") or ""
        elif field == "store_name":
            value = store.get("store_name", "") or ""
        else:
            value = store.get(field, "") or ""
        
        # Find the order for this value
        if categories:
            # Build order lookup
            order_map = {cat["id"]: cat.get("order", 99) for cat in categories}
            # Check for exact match or _other fallback
            if value in order_map:
                order = order_map[value]
            elif "_other" in order_map:
                order = order_map["_other"]
            else:
                order = 999
            key_parts.append((order, value))
        else:
            # No categories = alphabetical sort on this field
            key_parts.append((0, value))
    
    return tuple(key_parts)


def get_store_type_order() -> list:
    """Get store type order from config, falling back to default."""
    try:
        cfg = load_sort_order_config()
        order = cfg.get("store_type_order")
        if isinstance(order, list) and order:
            return order
    except Exception:
        dbg_ex("get_store_type_order")
    return _DEFAULT_STORE_TYPE_ORDER


def get_store_type_rank() -> dict:
    """Get rank mapping for store types."""
    order = get_store_type_order()
    return {t: i for i, t in enumerate(order)}

# Page / layout constants
MARGIN_L = 72
MARGIN_R = 72
MARGIN_T = 72
MARGIN_B = 72
LEADING  = 1.2  # line-height multiplier for wrapped text

# ----------------------------- JSON init / load / save -----------------------------

def ensure_json(path: str, default_obj):
    try:
        if not os.path.exists(path):
            # If we're running from a PyInstaller bundle, try to copy a bundled default
            # (if present) into the writable app dir.
            try:
                if getattr(sys, "frozen", False):
                    bundled_root = getattr(sys, "_MEIPASS", None)
                    if bundled_root:
                        src = Path(bundled_root) / Path(path).name
                        dst = Path(path)
                        if src.exists():
                            dbg(f"ensure_json: copying bundled {src} -> {dst}")
                            shutil.copyfile(src, dst)
            except Exception:
                dbg_ex("ensure_json: copy bundled")

        if not os.path.exists(path):
            dbg(f"ensure_json: creating {path}")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(default_obj, f, indent=4, ensure_ascii=False)
            return json.loads(json.dumps(default_obj))
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            dbg(f"ensure_json: loaded {path} (ok)")
            return data
    except json.JSONDecodeError:
        dbg(f"ensure_json: {path} corrupted; resetting")
        try:
            with open(path, "w", encoding="utf-8") as f2:
                json.dump(default_obj, f2, indent=4, ensure_ascii=False)
        except Exception:
            dbg_ex("ensure_json reset write failed")
        return json.loads(json.dumps(default_obj))
    except Exception:
        dbg_ex("ensure_json failure")
        return json.loads(json.dumps(default_obj))

def load_blackout_config() -> dict:
    return ensure_json(BLACKOUT_JSON, {})

def save_blackout_config(cfg: dict):
    try:
        with open(BLACKOUT_JSON, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=4, ensure_ascii=False)
        dbg(f"save_blackout_config: saved {sum(len(v) for v in cfg.values())} rules across {len(cfg)} sign types")
    except Exception:
        dbg_ex("save_blackout_config failure")

# ----------------------------- Tk helpers: reliable modal -----------------------------

def _center_on_screen(win: tk.Toplevel, w: int = 760, h: int = 520):
    try:
        win.update_idletasks()
        sw = win.winfo_screenwidth()
        sh = win.winfo_screenheight()
        x = max(0, (sw - w) // 2)
        y = max(0, (sh - h) // 3)
        win.geometry(f"{w}x{h}+{x}+{y}")
    except Exception:
        pass

def _show_modal(win: tk.Toplevel, parent: tk.Tk, name: str = "modal"):
    need_hide_parent = False
    try:
        def _on_close():
            dbg(f"_show_modal[{name}]: WM_DELETE_WINDOW")
            try:
                win.grab_release()
            except Exception:
                pass
            win.destroy()
        win.protocol("WM_DELETE_WINDOW", _on_close)

        win.withdraw()
        win.update_idletasks()
        _center_on_screen(win)
        try:
            if parent.state() != "withdrawn":
                win.transient(parent)
        except Exception:
            pass

        try:
            if parent.state() in ("iconic", "withdrawn"):
                if _WIN:
                    parent.attributes("-alpha", 0.0)
                parent.deiconify()
                need_hide_parent = True
        except Exception:
            pass

        win.deiconify()
        win.state("normal")
        win.lift()
        win.attributes("-topmost", True)
        win.focus_force()
        win.update_idletasks()

        if _WIN:
            _force_foreground(win)
            win.after(250, lambda: (_force_foreground(win)))

        win.wait_visibility()
        win.grab_set()

        win.after(400, lambda: win.attributes("-topmost", False))

        dbg(f"_show_modal[{name}]: mapped={win.winfo_ismapped()} viewable={win.winfo_viewable()} state={win.state()}")
        win.wait_window()
        dbg(f"_show_modal[{name}]: closed")
    finally:
        if _WIN and need_hide_parent:
            try:
                parent.withdraw()
                parent.attributes("-alpha", 1.0)
            except Exception:
                pass

# ----------------------------- GUI: blackout config -----------------------------

def gui_blackout_edit(root: tk.Tk):
    dbg("gui_blackout_edit: start")
    cfg = load_blackout_config()

    win = tk.Toplevel(root)
    win.title("Blackout Configuration (Add / Edit)")

    frame = tk.Frame(win)
    frame.pack(padx=10, pady=10, fill='both', expand=True)

    tk.Label(frame, text="Sign Type").grid(row=0, column=0, padx=5, pady=5, sticky='w')
    tk.Label(frame, text="Sign Version").grid(row=0, column=1, padx=5, pady=5, sticky='w')

    entries = []

    def add_entry(preset_type="", preset_version=""):
        r = len(entries) + 1
        e1 = tk.Entry(frame, width=28); e1.insert(0, preset_type)
        e2 = tk.Entry(frame, width=64); e2.insert(0, preset_version)
        e1.grid(row=r, column=0, padx=5, pady=3, sticky="ew")
        e2.grid(row=r, column=1, padx=5, pady=3, sticky="ew")
        entries.append((e1, e2))
        dbg(f"blackout_edit: add_entry r={r} type='{preset_type}' ver_len={len(preset_version)}")

    rows = 0
    for st, vers in cfg.items():
        for v in vers:
            add_entry(st, v); rows += 1
    if rows == 0:
        add_entry()
    dbg(f"blackout_edit: prepopulated rows={rows}")

    def save_config():
        try:
            new_cfg = {}
            for e1, e2 in entries:
                st = e1.get().strip()
                sv = e2.get().strip()
                if st and sv:
                    new_cfg.setdefault(st, []).append(sv)
            save_blackout_config(new_cfg)
            messagebox.showinfo("Blackout", "Saved to blackout_config.json", parent=win)
            win.destroy()
        except Exception:
            dbg_ex("blackout_edit save_config")

    btns = tk.Frame(win); btns.pack(pady=6)
    tk.Button(btns, text="Add Row", command=add_entry).pack(side='left', padx=5)
    tk.Button(btns, text="Save", command=save_config).pack(side='left', padx=5)

    _show_modal(win, root, name="blackout_edit")

def gui_blackout_delete(root: tk.Tk):
    dbg("gui_blackout_delete: start")
    cfg = load_blackout_config()

    win = tk.Toplevel(root)
    win.title("Blackout Configuration (Delete)")

    frame = tk.Frame(win); frame.pack(padx=10, pady=10, fill='both', expand=True)
    tk.Label(frame, text="Click 'Delete' to remove a rule").grid(row=0, column=0, columnspan=3, sticky='w', pady=(0,6))
    tk.Label(frame, text="Sign Type", font=("TkDefaultFont", 9, "bold")).grid(row=1, column=0, sticky='w')
    tk.Label(frame, text="Sign Version", font=("TkDefaultFont", 9, "bold")).grid(row=1, column=1, sticky='w')

    rows = [(st, v) for st, vs in cfg.items() for v in vs]
    dbg(f"blackout_delete: rows={len(rows)}")

    r = 2
    if not rows:
        tk.Label(frame, text="(No blackout rules)").grid(row=r, column=0, columnspan=3, sticky='w')
    else:
        for st, v in rows:
            tk.Label(frame, text=st).grid(row=r, column=0, sticky='w', padx=3, pady=2)
            tk.Label(frame, text=v).grid(row=r, column=1, sticky='w', padx=3, pady=2)
            def make_del(s=st, ver=v):
                return lambda: _delete_and_refresh(cfg, s, ver, win)
            tk.Button(frame, text="Delete", command=make_del()).grid(row=r, column=2, padx=3, pady=2)
            r += 1

    tk.Button(win, text="Close", command=win.destroy).pack(pady=6)
    _show_modal(win, root, name="blackout_delete")

def _delete_and_refresh(cfg, st, ver, win):
    try:
        dbg(f"_delete_and_refresh: '{st}' -> '{ver}'")
        lst = cfg.get(st, [])
        if ver in lst:
            lst.remove(ver)
        if not lst and st in cfg:
            del cfg[st]
        save_blackout_config(cfg)
        messagebox.showinfo("Blackout", f"Deleted: {st} — {ver}", parent=win)
        win.destroy()
    except Exception:
        dbg_ex("_delete_and_refresh failure")


# ----------------------------- GUI: blackout enable/disable settings -----------------------------

def gui_blackout_settings(root: tk.Tk):
    """GUI to enable/disable individual blackout rules without deleting them."""
    dbg("gui_blackout_settings: start")
    cfg = load_blackout_config()
    settings = load_blackout_settings()
    
    win = tk.Toplevel(root)
    win.title("Blackout Settings (Enable/Disable Rules)")
    
    # Main frame with scrollbar
    main_frame = tk.Frame(win)
    main_frame.pack(padx=10, pady=10, fill='both', expand=True)
    
    # Global toggle
    global_var = tk.BooleanVar(value=settings.get("global_enabled", True))
    global_chk = tk.Checkbutton(main_frame, text="Enable Blackout Processing (Global)", 
                                 variable=global_var, font=("TkDefaultFont", 10, "bold"))
    global_chk.pack(anchor='w', pady=(0, 10))
    
    # Canvas for scrollable content
    canvas = tk.Canvas(main_frame, height=350)
    scrollbar = tk.Scrollbar(main_frame, orient="vertical", command=canvas.yview)
    scrollable_frame = tk.Frame(canvas)
    
    scrollable_frame.bind(
        "<Configure>",
        lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
    )
    
    canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
    canvas.configure(yscrollcommand=scrollbar.set)
    
    tk.Label(scrollable_frame, text="Sign Type", font=("TkDefaultFont", 9, "bold")).grid(row=0, column=0, sticky='w', padx=5)
    tk.Label(scrollable_frame, text="Version", font=("TkDefaultFont", 9, "bold")).grid(row=0, column=1, sticky='w', padx=5)
    tk.Label(scrollable_frame, text="Enabled", font=("TkDefaultFont", 9, "bold")).grid(row=0, column=2, sticky='w', padx=5)
    
    # Build list of all rules with checkboxes
    rule_vars = {}  # (st, ver) -> BooleanVar
    enabled_rules = settings.get("enabled_rules", {})
    
    rows = [(st, v) for st, vs in cfg.items() for v in vs]
    dbg(f"blackout_settings: rules={len(rows)}")
    
    r = 1
    if not rows:
        tk.Label(scrollable_frame, text="(No blackout rules defined)").grid(row=r, column=0, columnspan=3, sticky='w')
    else:
        for st, v in rows:
            rule_key = f"{st}|{v}"
            # Default to True if not explicitly set
            is_enabled = enabled_rules.get(rule_key, True)
            var = tk.BooleanVar(value=is_enabled)
            rule_vars[(st, v)] = var
            
            tk.Label(scrollable_frame, text=st[:30]).grid(row=r, column=0, sticky='w', padx=5, pady=2)
            tk.Label(scrollable_frame, text=v[:50] + ("..." if len(v) > 50 else "")).grid(row=r, column=1, sticky='w', padx=5, pady=2)
            tk.Checkbutton(scrollable_frame, variable=var).grid(row=r, column=2, padx=5, pady=2)
            r += 1
    
    canvas.pack(side="left", fill="both", expand=True)
    scrollbar.pack(side="right", fill="y")
    
    def save_settings():
        try:
            new_enabled = {}
            for (st, v), var in rule_vars.items():
                rule_key = f"{st}|{v}"
                new_enabled[rule_key] = var.get()
            new_settings = {
                "global_enabled": global_var.get(),
                "enabled_rules": new_enabled
            }
            save_blackout_settings(new_settings)
            messagebox.showinfo("Blackout Settings", "Settings saved to blackout_settings.json", parent=win)
            win.destroy()
        except Exception:
            dbg_ex("blackout_settings save")
    
    def enable_all():
        for var in rule_vars.values():
            var.set(True)
    
    def disable_all():
        for var in rule_vars.values():
            var.set(False)
    
    btns = tk.Frame(win)
    btns.pack(pady=6)
    tk.Button(btns, text="Enable All", command=enable_all).pack(side='left', padx=5)
    tk.Button(btns, text="Disable All", command=disable_all).pack(side='left', padx=5)
    tk.Button(btns, text="Save", command=save_settings).pack(side='left', padx=5)
    tk.Button(btns, text="Cancel", command=win.destroy).pack(side='left', padx=5)
    
    _show_modal(win, root, name="blackout_settings")


# ----------------------------- GUI: tiered sort order customization -----------------------------

def gui_sort_order_edit(root: tk.Tk):
    """GUI to customize the tiered store sorting system."""
    dbg("gui_sort_order_edit: start")
    cfg = load_sort_order_config()
    tiered_cfg = cfg.get("tiered_sort", _DEFAULT_TIERED_SORT)
    
    win = tk.Toplevel(root)
    win.title("Tiered Sort Configuration")
    win.minsize(900, 600)
    
    # Main container
    main_frame = tk.Frame(win)
    main_frame.pack(padx=10, pady=10, fill='both', expand=True)
    
    # Header
    header = tk.Frame(main_frame)
    header.pack(fill='x', pady=(0, 10))
    
    tk.Label(header, text="Tiered Sorting Configuration", 
             font=("TkDefaultFont", 14, "bold")).pack(side='left')
    
    use_tiered_var = tk.BooleanVar(value=cfg.get("use_tiered_sort", True))
    tk.Checkbutton(header, text="Enable Tiered Sorting", variable=use_tiered_var,
                   font=("TkDefaultFont", 10)).pack(side='right')
    
    tk.Label(main_frame, text="Each tier represents a sorting priority level. Tier 1 is highest priority.\n"
                              "Within each tier, categories are sorted by their order number (lowest first).\n"
                              "Use ▲/▼ to reorder tiers. Toggle tiers on/off. Drag categories to reorder.",
             font=("TkDefaultFont", 9), justify='left').pack(anchor='w', pady=(0, 10))
    
    # Canvas with scrollbar for tiers
    canvas_frame = tk.Frame(main_frame)
    canvas_frame.pack(fill='both', expand=True)
    
    canvas = tk.Canvas(canvas_frame, bg='#f5f5f5')
    scrollbar_y = tk.Scrollbar(canvas_frame, orient="vertical", command=canvas.yview)
    scrollbar_x = tk.Scrollbar(canvas_frame, orient="horizontal", command=canvas.xview)
    
    tiers_container = tk.Frame(canvas, bg='#f5f5f5')
    
    canvas.create_window((0, 0), window=tiers_container, anchor="nw")
    canvas.configure(yscrollcommand=scrollbar_y.set, xscrollcommand=scrollbar_x.set)
    
    # Store tier data for manipulation
    tier_data = []  # List of dicts with widgets and data
    
    def refresh_tiers():
        """Rebuild the tier display from tier_data."""
        for widget in tiers_container.winfo_children():
            widget.destroy()
        
        for idx, tier in enumerate(tier_data):
            tier_frame = tk.LabelFrame(tiers_container, text=f"Tier {idx + 1}: {tier['name']}", 
                                        font=("TkDefaultFont", 11, "bold"),
                                        bg='white', padx=10, pady=8)
            tier_frame.pack(fill='x', padx=5, pady=5, anchor='w')
            
            # Tier controls row
            controls = tk.Frame(tier_frame, bg='white')
            controls.pack(fill='x', pady=(0, 8))
            
            # Enable checkbox
            enabled_var = tk.BooleanVar(value=tier.get('enabled', True))
            tier['enabled_var'] = enabled_var
            tk.Checkbutton(controls, text="Enabled", variable=enabled_var, bg='white').pack(side='left')
            
            # Field info
            tk.Label(controls, text=f"  Field: {tier['field']}", bg='white', 
                     font=("TkDefaultFont", 9, "italic")).pack(side='left', padx=(20, 0))
            
            # Move buttons
            btn_frame = tk.Frame(controls, bg='white')
            btn_frame.pack(side='right')
            
            if idx > 0:
                tk.Button(btn_frame, text="▲ Move Up", width=10,
                         command=lambda i=idx: move_tier(i, -1)).pack(side='left', padx=2)
            if idx < len(tier_data) - 1:
                tk.Button(btn_frame, text="▼ Move Down", width=10,
                         command=lambda i=idx: move_tier(i, 1)).pack(side='left', padx=2)
            
            # Categories section
            cats = tier.get('categories', [])
            if cats:
                cat_frame = tk.Frame(tier_frame, bg='#fafafa', relief='sunken', bd=1)
                cat_frame.pack(fill='x', pady=5)
                
                # Header row
                header_row = tk.Frame(cat_frame, bg='#e0e0e0')
                header_row.pack(fill='x')
                tk.Label(header_row, text="Order", width=8, bg='#e0e0e0', 
                         font=("TkDefaultFont", 9, "bold")).pack(side='left', padx=5)
                tk.Label(header_row, text="ID", width=15, bg='#e0e0e0',
                         font=("TkDefaultFont", 9, "bold")).pack(side='left', padx=5)
                tk.Label(header_row, text="Label", width=20, bg='#e0e0e0',
                         font=("TkDefaultFont", 9, "bold")).pack(side='left', padx=5)
                tk.Label(header_row, text="Actions", width=15, bg='#e0e0e0',
                         font=("TkDefaultFont", 9, "bold")).pack(side='left', padx=5)
                
                # Category entries
                tier['cat_widgets'] = []
                for cat_idx, cat in enumerate(sorted(cats, key=lambda c: c.get('order', 99))):
                    cat_row = tk.Frame(cat_frame, bg='#fafafa')
                    cat_row.pack(fill='x', pady=2)
                    
                    order_var = tk.StringVar(value=str(cat.get('order', cat_idx + 1)))
                    order_entry = tk.Entry(cat_row, textvariable=order_var, width=6)
                    order_entry.pack(side='left', padx=5)
                    
                    id_var = tk.StringVar(value=cat.get('id', ''))
                    id_entry = tk.Entry(cat_row, textvariable=id_var, width=15)
                    id_entry.pack(side='left', padx=5)
                    
                    label_var = tk.StringVar(value=cat.get('label', ''))
                    label_entry = tk.Entry(cat_row, textvariable=label_var, width=20)
                    label_entry.pack(side='left', padx=5)
                    
                    # Move up/down within category
                    cat_btn_frame = tk.Frame(cat_row, bg='#fafafa')
                    cat_btn_frame.pack(side='left', padx=5)
                    
                    tk.Button(cat_btn_frame, text="▲", width=3,
                             command=lambda ti=idx, ci=cat_idx: move_category(ti, ci, -1)).pack(side='left')
                    tk.Button(cat_btn_frame, text="▼", width=3,
                             command=lambda ti=idx, ci=cat_idx: move_category(ti, ci, 1)).pack(side='left')
                    
                    tier['cat_widgets'].append({
                        'order_var': order_var,
                        'id_var': id_var,
                        'label_var': label_var,
                        'original_cat': cat
                    })
            else:
                tk.Label(tier_frame, text="(Alphabetical sort - no fixed categories)", 
                         bg='white', font=("TkDefaultFont", 9, "italic")).pack(anchor='w')
        
        # Update scroll region
        tiers_container.update_idletasks()
        canvas.configure(scrollregion=canvas.bbox("all"))
    
    def move_tier(index, direction):
        """Move a tier up or down."""
        new_idx = index + direction
        if 0 <= new_idx < len(tier_data):
            tier_data[index], tier_data[new_idx] = tier_data[new_idx], tier_data[index]
            refresh_tiers()
    
    def move_category(tier_idx, cat_idx, direction):
        """Move a category up or down within a tier (by adjusting order numbers)."""
        cats = tier_data[tier_idx].get('categories', [])
        sorted_cats = sorted(cats, key=lambda c: c.get('order', 99))
        
        new_idx = cat_idx + direction
        if 0 <= new_idx < len(sorted_cats):
            # Swap order numbers
            old_order = sorted_cats[cat_idx].get('order', cat_idx + 1)
            new_order = sorted_cats[new_idx].get('order', new_idx + 1)
            sorted_cats[cat_idx]['order'] = new_order
            sorted_cats[new_idx]['order'] = old_order
            tier_data[tier_idx]['categories'] = sorted_cats
            refresh_tiers()
    
    def collect_current_state() -> dict:
        """Collect current tier configuration from widgets."""
        result_tiers = []
        for tier in tier_data:
            tier_dict = {
                'name': tier['name'],
                'field': tier['field'],
                'enabled': tier.get('enabled_var', tk.BooleanVar(value=True)).get(),
                'categories': []
            }
            for cat_w in tier.get('cat_widgets', []):
                try:
                    order = int(cat_w['order_var'].get())
                except ValueError:
                    order = 99
                tier_dict['categories'].append({
                    'id': cat_w['id_var'].get(),
                    'label': cat_w['label_var'].get(),
                    'order': order
                })
            result_tiers.append(tier_dict)
        return {'tiers': result_tiers}
    
    def save_config():
        try:
            new_tiered = collect_current_state()
            new_cfg = cfg.copy()
            new_cfg['tiered_sort'] = new_tiered
            new_cfg['use_tiered_sort'] = use_tiered_var.get()
            save_sort_order_config(new_cfg)
            messagebox.showinfo("Sort Order", "Tiered sort configuration saved!", parent=win)
            win.destroy()
        except Exception:
            dbg_ex("tiered sort save")
            messagebox.showerror("Error", "Failed to save configuration", parent=win)
    
    def reset_default():
        nonlocal tier_data
        tier_data = [t.copy() for t in _DEFAULT_TIERED_SORT['tiers']]
        # Deep copy categories
        for t in tier_data:
            t['categories'] = [c.copy() for c in t.get('categories', [])]
        use_tiered_var.set(True)
        refresh_tiers()
    
    def add_tier():
        """Add a new custom tier."""
        new_name = simpledialog.askstring("New Tier", "Enter tier name:", parent=win)
        if not new_name:
            return
        new_field = simpledialog.askstring("New Tier", "Enter field name (e.g., 'class', 'area'):", 
                                           parent=win)
        if not new_field:
            return
        tier_data.append({
            'name': new_name,
            'field': new_field,
            'enabled': True,
            'categories': []
        })
        refresh_tiers()
    
    def add_category_to_tier():
        """Add a category to a tier."""
        if not tier_data:
            messagebox.showwarning("No Tiers", "Add a tier first.", parent=win)
            return
        tier_names = [f"{i+1}: {t['name']}" for i, t in enumerate(tier_data)]
        tier_choice = simpledialog.askstring(
            "Add Category", 
            f"Which tier? Enter number (1-{len(tier_data)}):\n" + "\n".join(tier_names),
            parent=win
        )
        if not tier_choice:
            return
        try:
            tier_idx = int(tier_choice) - 1
            if tier_idx < 0 or tier_idx >= len(tier_data):
                raise ValueError()
        except ValueError:
            messagebox.showerror("Invalid", "Invalid tier number", parent=win)
            return
        
        cat_id = simpledialog.askstring("Add Category", "Category ID:", parent=win)
        if not cat_id:
            return
        cat_label = simpledialog.askstring("Add Category", "Category Label:", parent=win)
        if not cat_label:
            cat_label = cat_id
        
        existing = tier_data[tier_idx].get('categories', [])
        max_order = max([c.get('order', 0) for c in existing] or [0])
        tier_data[tier_idx]['categories'].append({
            'id': cat_id,
            'label': cat_label,
            'order': max_order + 1
        })
        refresh_tiers()
    
    # Initialize tier_data from config
    tier_data = []
    for t in tiered_cfg.get('tiers', []):
        tier_copy = {
            'name': t.get('name', 'Unknown'),
            'field': t.get('field', ''),
            'enabled': t.get('enabled', True),
            'categories': [c.copy() for c in t.get('categories', [])]
        }
        tier_data.append(tier_copy)
    
    refresh_tiers()
    
    # Layout canvas
    canvas.pack(side='left', fill='both', expand=True)
    scrollbar_y.pack(side='right', fill='y')
    scrollbar_x.pack(side='bottom', fill='x')
    
    # Button bar
    btns = tk.Frame(main_frame)
    btns.pack(fill='x', pady=10)
    
    tk.Button(btns, text="Add Tier", command=add_tier).pack(side='left', padx=5)
    tk.Button(btns, text="Add Category", command=add_category_to_tier).pack(side='left', padx=5)
    tk.Button(btns, text="Reset to Default", command=reset_default).pack(side='left', padx=5)
    tk.Button(btns, text="Save", command=save_config, bg='#4CAF50', fg='white').pack(side='right', padx=5)
    tk.Button(btns, text="Cancel", command=win.destroy).pack(side='right', padx=5)
    
    _show_modal(win, root, name="sort_order_edit")


def get_effective_blackout_config() -> dict:
    """Get blackout config with disabled rules filtered out."""
    cfg = load_blackout_config()
    settings = load_blackout_settings()
    
    if not settings.get("global_enabled", True):
        dbg("get_effective_blackout_config: global disabled, returning empty")
        return {}
    
    enabled_rules = settings.get("enabled_rules", {})
    effective = {}
    
    for st, versions in cfg.items():
        enabled_versions = []
        for v in versions:
            rule_key = f"{st}|{v}"
            # Default to True if not explicitly set
            if enabled_rules.get(rule_key, True):
                enabled_versions.append(v)
        if enabled_versions:
            effective[st] = enabled_versions
    
    dbg(f"get_effective_blackout_config: {sum(len(v) for v in effective.values())} rules active")
    return effective


# ----------------------------- Header / classification -----------------------------

def is_header_page(text: str) -> bool:
    return bool(HEADER_STORE_RE.search(text))

def extract_store_info(text: str) -> dict:
    out = {}
    try:
        for line in text.splitlines():
            if 'Sign Type' in line:
                break
            if 'Store:' in line:
                out['store'] = line.split('Store:')[-1].strip()
            elif 'Area:' in line:
                out['area'] = line.split('Area:')[-1].strip()
            elif 'Class:' in line:
                out['class'] = line.split('Class:')[-1].strip()
            else:
                m = re.search(r'\b(NY|PA|OH|New York|Pennsylvania|Ohio)\b', line, re.I)
                if m and 'location' not in out:
                    nm = m.group().upper()
                    map_ = {'NEW YORK': 'NY', 'PENNSYLVANIA': 'PA', 'OHIO': 'OH'}
                    out['location'] = map_.get(nm, nm)
    except Exception:
        dbg_ex("extract_store_info")
    return out

def clean_text_for_kits(text: str) -> str:
    t = re.sub(r'\s+', ' ', text)
    t = re.sub(r'\s*\*\s*C\s*A\s*N\s*D\s*Y\s*;\s*C\s*O\s*U\s*N\s*T\s*E\s*R\s*K\s*I\s*T\s*\*', KIT_COUNTER, t, flags=re.I)
    t = re.sub(r'\s*\*\s*C\s*A\s*N\s*D\s*Y\s*;\s*S\s*H\s*I\s*P\s*P\s*E\s*R\s*K\s*I\s*T\s*\*',   KIT_SHIPPER, t, flags=re.I)
    t = re.sub(r'\s*\*\s*S\s*h\s*e\s*l\s*f\s*\s*W\s*o\s*b\s*b\s*l\s*e\s*r\s*\s*K\s*i\s*t\s*;\s*A\s*l\s*c\s*o\s*h\s*o\s*l\s*\s*V\s*e\s*r\s*s\s*i\s*o\s*n\s*\*', KIT_ALC, t, flags=re.I)
    t = re.sub(r'\s*\*\s*S\s*h\s*e\s*l\s*f\s*\s*W\s*o\s*b\s*b\s*l\s*e\s*r\s*\s*K\s*i\s*t\s*;\s*N\s*o\s*n\s*-\s*A\s*l\s*c\s*o\s*h\s*o\s*l\s*\s*V\s*e\s*r\s*s\s*i\s*o\s*n\s*\*', KIT_NONALC, t, flags=re.I)
    return t

def classify_store(accum_text: str) -> dict:
    t = clean_text_for_kits(accum_text)
    is_counter    = KIT_COUNTER in t
    is_shipper    = KIT_SHIPPER in t
    is_alcohol    = KIT_ALC in t
    is_nonalcohol = (KIT_NONALC in t) and not is_alcohol

    # Also treat user-defined starred tokens as kit markers (including *_ltd variants).
    try:
        rules = load_custom_rules()
        for tok in STAR_TOKEN_RE.findall(t):
            a = _get_star_rule_action(rules, canon(tok))
            if a in ("counter_kit", "counter_kit_ltd"):
                is_counter = True
            elif a in ("shipper_kit", "shipper_kit_ltd"):
                is_shipper = True
            # (Alcohol/non-alcohol wobblers are still detected via the explicit KIT_* strings.)
    except Exception:
        dbg_ex("classify_store starred-kit detection")

    alc = 'Alcohol' if is_alcohol else ('Non-Alcohol' if is_nonalcohol else '')
    if is_counter and is_shipper:
        store_type = f'{alc} Counter + Shipper'
    elif is_counter:
        store_type = f'{alc} Counter'
    elif is_shipper:
        store_type = f'{alc} Shipper'
    else:
        store_type = f'{alc} No Counter/Shipper'

    return {
        'store_type': store_type.strip(),
        'is_counter': is_counter,
        'is_shipper': is_shipper,
        'is_alcohol': is_alcohol,
        'is_non_alcohol': is_nonalcohol
    }

# ----------------------------- Geometry-aware rows -----------------------------

def detect_columns(page):
    try:
        rs = page.search_for('Sign Type')
        rp = page.search_for('Promotion Name')
        rq = page.search_for('Qty Ordered')
        rect_sign  = rs[0] if rs else None
        rect_promo = rp[0] if rp else None
        rect_qty   = rq[0] if rq else None
        w = page.rect.width
        if not rect_promo:
            rect_promo = fitz.Rect(w*0.25, 0, w*0.55, 20)
        if not rect_qty:
            rect_qty   = fitz.Rect(w*0.80, 0, w*0.95, 20)
        header_bottom = max([r.y1 for r in [rect_sign, rect_promo, rect_qty] if r] or [0])
        return {
            'x_promo_left': rect_promo.x0,
            'x_qty_left': rect_qty.x0,
            'header_bottom': header_bottom
        }
    except Exception:
        dbg_ex("detect_columns")
        return {'x_promo_left': page.rect.width*0.25, 'x_qty_left': page.rect.width*0.80, 'header_bottom': 0}

def iter_rows(page, y_min, y_max):
    try:
        words = page.get_text('words')  # x0,y0,x1,y1,txt,block,line,wordno
    except Exception:
        dbg_ex("iter_rows get_text words")
        words = []

    rows = defaultdict(list)
    for x0,y0,x1,y1,txt,blk,ln,wn in words:
        if y0 < y_min or y1 > y_max:
            continue
        rows[(blk, ln, round(y0, 1))].append((x0,y0,x1,y1,txt,wn))
    cols = detect_columns(page)
    x_prom = cols['x_promo_left']; x_qty = cols['x_qty_left']
    for key in sorted(rows.keys(), key=lambda k: k[2]):
        parts = sorted(rows[key], key=lambda t: t[-1])
        left, mid, right = [], [], []
        x0s, y0s, x1s, y1s = [], [], [], []
        for x0,y0,x1,y1,txt,wn in parts:
            xc = 0.5*(x0+x1)
            if xc < x_prom:
                left.append(txt)
            elif xc < x_qty:
                mid.append(txt)
            else:
                right.append(txt)
            x0s.append(x0); y0s.append(y0); x1s.append(x1); y1s.append(y1)
        rect = fitz.Rect(min(x0s), min(y0s), max(x1s), max(y1s))
        yield {
            'type_text': ' '.join(left).strip(),
            'promo_text': ' '.join(mid).strip(),
            'qty_text': ' '.join(right).strip(),
            'rect': rect
        }

# ----------------------------- Blackout / Highlight / Annotation -----------------------------

def is_predetermined_wobbler(promo: str) -> bool:
    return canon(promo) in _PREDETERMINED_WOBBLERS_CANON

def blackout_rows_on_page(page, blackout_cfg):
    try:
        if not blackout_cfg:
            return
        cols = detect_columns(page)
        y_min = cols['header_bottom'] + 2
        y_max = page.rect.y1 - 36
        canon_map = {canon(st): {canon(v) for v in vs} for st,vs in blackout_cfg.items()}
        last_type = None
        count = 0
        for row in iter_rows(page, y_min, y_max):
            st_this = canon(row['type_text'])
            st = st_this or last_type
            pv = canon(row['promo_text'])
            if st_this:
                last_type = st_this
            if not st or not pv:
                continue
            if st in canon_map and pv in canon_map[st]:
                page.draw_rect(row['rect'], color=(0,0,0), fill=(0,0,0), width=0)
                count += 1
        if count and DEBUG:
            dbg(f"blackout_rows_on_page: blacked_out_rows={count}")
    except Exception:
        dbg_ex("blackout_rows_on_page")

def highlight_keyword(page, needle, color):
    try:
        quads = page.search_for(needle, quads=True)
    except TypeError:
        quads = [fitz.Quad(r) for r in page.search_for(needle)]
    for q in quads:
        page.draw_quad(q, color=None, width=0, fill=color, fill_opacity=0.60, overlay=True)

def annotate_wobbler_kit(page, kit_name: str):
    try:
        if not kit_name:
            return
        cols = detect_columns(page)
        y_min = cols['header_bottom'] + 2
        y_max = page.rect.y1 - 36
        x_left_type = 12
        added = 0
        for row in iter_rows(page, y_min, y_max):
            if canon(row['type_text']) == TYPE_SHELF_WOBBLER_CANON:
                x = max(x_left_type, row['rect'].x0 + 4)
                y = row['rect'].y1 + 7
                if y < (page.rect.y1 - 8):
                    page.insert_text((x, y), f"Kit: {kit_name}", fontsize=8, color=(0.2,0.2,0.2))
                    added += 1
        if added and DEBUG:
            dbg(f"annotate_wobbler_kit: wrote '{kit_name}' x{added}")
    except Exception:
        dbg_ex("annotate_wobbler_kit")

def blackout_nonalc_wobbler_row_on_page(page):
    try:
        cols = detect_columns(page)
        y_min = cols['header_bottom'] + 2
        y_max = page.rect.y1 - 36
        n = 0
        last_type = None
        for row in iter_rows(page, y_min, y_max):
            st_this = canon(row['type_text'])
            if st_this:
                last_type = st_this
            st = last_type
            pv = canon(row['promo_text'])
            if not st or not pv:
                continue
            is_nonalc = (
                pv == PROMO_WOBBLER_NONALC_CANON
                or ('non' in pv and 'alcohol' in pv and 'wobbler' in pv)
            )
            if st == TYPE_SHELF_WOBBLER_CANON and is_nonalc:
                page.draw_rect(row['rect'], color=(0,0,0), fill=(0,0,0), width=0)
                n += 1
        if n and DEBUG:
            dbg(f"blackout_nonalc_wobbler_row_on_page: blacked_out={n}")
    except Exception:
        dbg_ex("blackout_nonalc_wobbler_row_on_page")

# ----------------------------- Store indexing + item extraction -----------------------------

def index_stores(doc: fitz.Document):
    dbg("index_stores: start")
    stores = []
    current = None
    accum = ""
    meta = {}
    try:
        for i in range(len(doc)):
            page = doc[i]
            if i % 25 == 0:
                dbg(f"index_stores: at page {i}")
            try:
                text = str(page.get_text('text') or "")
            except Exception:
                dbg_ex(f"index_stores get_text page {i}"); continue
            if not text.strip():
                continue
            if is_header_page(text):
                if current:
                    cls = classify_store(accum)
                    store_name = meta.get('store', f'UNKNOWN_{i}')
                    store_cls  = meta.get('class', '')
                    stores.append({
                        'store_id':   f"{store_name}|{store_cls}",
                        'store_name': store_name,
                        'store_type': cls['store_type'],
                        'location':   meta.get('location', ''),
                        'class':      store_cls,
                        'pages':      current['pages'],
                        'meta':       meta.copy()
                    })
                meta = extract_store_info(text)
                current = {'pages':[i]}
                accum = text + " "
            else:
                accum += text + " "
                if current:
                    current['pages'].append(i)

        if current:
            cls = classify_store(accum)
            store_name = meta.get('store', 'UNKNOWN_END')
            store_cls  = meta.get('class', '')
            stores.append({
                'store_id':   f"{store_name}|{store_cls}",
                'store_name': store_name,
                'store_type': cls['store_type'],
                'location':   meta.get('location', ''),
                'class':      store_cls,
                'pages':      current['pages'],
                'meta':       meta.copy()
            })
    except Exception:
        dbg_ex("index_stores")
    dbg(f"index_stores: found stores={len(stores)}")
    return stores

def extract_items_from_pages(doc: fitz.Document, pages):
    items = []
    last_type = None
    promo_buf = []
    try:
        for p in pages:
            page = doc[p]
            cols = detect_columns(page)
            y_min = cols['header_bottom'] + 2
            y_max = page.rect.y1 - 36
            for row in iter_rows(page, y_min, y_max):
                t = row['type_text'].strip()
                pr = row['promo_text'].strip()
                qt = row['qty_text'].strip()
                if t:
                    last_type = t
                if 'Sign Type Total' in (t + ' ' + pr):
                    last_type = None
                    promo_buf = []
                    continue
                if qt.isdigit() and last_type:
                    full_promo = ' '.join([p for p in (promo_buf + [pr]) if p]).strip()
                    if full_promo:
                        items.append({'type': last_type, 'promo': full_promo, 'qty': int(qt)})
                    promo_buf = []
                else:
                    if pr and not re.search(r'[a-z]+://|www\.', pr, re.I):
                        promo_buf.append(pr)
    except Exception:
        dbg_ex("extract_items_from_pages")
    return items

# ----------------------------- Wobbler kit grouping (post-determined) -----------------------------

def group_wobbler_kits(stores, min_stores=10):
    dbg("group_wobbler_kits: start")
    rep_text = {}
    combos = OrderedDict()
    try:
        for s in stores:
            items = s.get('items', [])
            wob = []
            for it in items:
                if canon(it['type']) != TYPE_SHELF_WOBBLER_CANON:
                    continue
                if is_predetermined_wobbler(it['promo']):
                    continue
                cp = canon(it['promo'])
                rep_text.setdefault(cp, it['promo'])
                wob.append((cp, it['qty']))
            if len(wob) <= 1:
                continue
            key = tuple(sorted(wob))
            combos.setdefault(key, []).append((s['store_id'], s['store_name']))

        kits = []
        idx = 1
        for key, store_list in combos.items():
            if len(store_list) < min_stores:
                continue
            items_disp = [{'promo': rep_text[p], 'qty': q} for (p,q) in key]
            store_ids  = [sid for sid,_ in store_list]
            store_names= sorted([nm for _,nm in store_list])
            kits.append({
                'kit_name': f'{idx}',
                'items': items_disp,
                'stores': store_names,
                'store_ids': store_ids,
                'store_count': len(store_list),
            })
            idx += 1
        kits.sort(key=lambda k: k['store_count'], reverse=True)
        kit_by_store_id = {}
        for kit in kits:
            for sid in kit['store_ids']:
                kit_by_store_id[sid] = kit['kit_name']
        dbg(f"group_wobbler_kits: kits={len(kits)}")
        return kits, kit_by_store_id
    except Exception:
        dbg_ex("group_wobbler_kits")
        return [], {}

# ----------------------------- Box/Envelope Classification -----------------------------

KW = {
    "banner": ("banner sign",),
    "yard": ("yard sign",),
    "aframe": ("a frame", "a-frame"),
    "bollard": ("bollard cover",),
    "polekit": ("pole sign kit", "pole sign"),
    "windmaster": ("windmaster",),
    "door_24x36": ("door decal 24x36", "door sign 24x36"),
    "door_6x30": ("door decal 24x6","Door Decal; 24\"W X 6\"H",),
    "window_sign": ("window sign",),
    "pump_topper": ("pump topper",),
    "corner_cooler": ("corner cooler cling", "corner cooler"),
    "starburst": ("starbursts",),
    "wobbler": ("shelf wobbler", "wobbler"),
    "nozzle": ("nozzle talker", "nozzle"),
}

SIZE_ORDER = [
    "nozzle",        # smallest
    "wobbler",
    "corner_cooler",
    "starburst",
    "pump_topper",
    "banner",
    "door_6x30",
    "yard",
    "window_sign",
    "door_24x36",
    "aframe",
    "polekit",
    "windmaster",
    "bollard",       # largest
]
SIZE_INDEX = {key: i for i, key in enumerate(SIZE_ORDER)}

def _type_key(canon_type: str) -> Optional[str]:
    s = canon_type
    # User overrides first (substring match)
    try:
        rules = load_custom_rules()
        overrides = (rules.get("type_overrides") or {})
        for needle, mapped_key in overrides.items():
            if needle and canon(needle) in s:
                return mapped_key
    except Exception:
        pass

    # Built-in keyword matching
    for key, needles in KW.items():
        for n in needles:
            nn = canon(n)
            if nn and nn in s:
                return key
    return None

def _max_size_key(items) -> Optional[str]:
    max_key = None
    max_idx = -1
    for it in items or []:
        key = _type_key(canon(it.get("type","")))
        if key is None:
            # unknown → treat as larger than pump topper for safety in boxing logic
            return None  # will be handled as STANDARD below
        idx = SIZE_INDEX.get(key, -1)
        if idx > max_idx:
            max_idx = idx
            max_key = key
    return max_key

def _count_by_key(items, key) -> int:
    total = 0
    for it in items or []:
        if _type_key(canon(it.get("type",""))) == key:
            total += int(it.get("qty", 0) or 0)
    return total

# ---- NEW helpers for banner/PT detection across fields ----
def _has_banner(items) -> bool:
    # Treat either explicit word 'banner' OR user-defined starred tokens as banner indicators.
    try:
        rules = load_custom_rules()
    except Exception:
        rules = {}

    for it in items or []:
        if "banner" in canon(it.get("type", "")) or "banner" in canon(it.get("promo", "")):
            return True
        promo = str(it.get("promo", "") or "")
        for tok in STAR_TOKEN_RE.findall(promo):
            if _get_star_rule_action(rules, canon(tok)) == "banner":
                return True
    return False

def _banner_qty(items) -> int:
    """Count banner quantity across BOTH Sign Type and Promotion Name (plus custom starred rules)."""
    try:
        rules = load_custom_rules()
    except Exception:
        rules = {}

    total = 0
    for it in items or []:
        qty = int(it.get("qty", 0) or 0)
        t = canon(it.get("type", ""))
        p = canon(it.get("promo", ""))
        if "banner" in t or "banner" in p:
            total += qty
            continue
        promo_raw = str(it.get("promo", "") or "")
        if any(_get_star_rule_action(rules, canon(tok)) == "banner" for tok in STAR_TOKEN_RE.findall(promo_raw)):
            total += qty
    return total

def _has_pump_topper_type(items) -> bool:
    for it in items or []:
        if "pump topper" in canon(it.get("type","")):
            return True
    return False

def analyze_order_boxing(items, standard_box_label="8x8x30"):
    """
    Returns dict:
      {
        'category': one of ['28x2x44','8x8x36', standard_box_label, 'Padded Envelope','Padded Pack','Stay Flat Envelope', None],
        'manual_flag': bool,
        'manual_reason': str or '',
        'capacity_sum': float,
        'hasBanner': bool,
        'hasPT': bool
      }
    Policy (updated):
      - Detect banners by searching BOTH Sign Type and Promotion Name for "banner".
      - Any order with a banner (hasBanner) cannot be STANDARD; if no big types, box = 8x8x36.
      - Big types present (Yard/A-Frame/Bollard/PoleKit) => 28x2x44. If cap_sum>4 => manual review.
      - If has_big_types AND hasBanner, still use cap_sum rule against 28x2x44 (manual if >4).
      - Pump Topper detection is based on Sign Type only. If hasPT and there are no larger sign
        types than pump_topper present, categorize as Stay Flat Envelope.
      - Banner-only (no big types) => 8x8x36.
      - Standard box (STANDARD) → if Door 24x36 or Windmaster present AND not blocked by banner.
      - Unknown/Unmapped types → STANDARD (safety).
      - Envelope rules remain as before for small-only mixes.
      - Max one box per order.
    """
    q = {k: _count_by_key(items, k) for k in KW.keys()}

    has_big_types = any(q[k] > 0 for k in ("yard", "aframe", "bollard", "polekit"))
    banner_qty = _banner_qty(items)
    cap_sum = (q["aframe"] * 1.0) + (q["bollard"] * 1.0) + (q["polekit"] * 1.0) + (q["yard"] * 0.5) + (banner_qty * 2.0)

    hasBanner = banner_qty > 0
    hasPT = _has_pump_topper_type(items)
    max_key = _max_size_key(items)  # based on Sign Type

    # Big-box logic first; banner doesn't override big types, only affects STANDARD disqualification
    if has_big_types:
        if cap_sum > 4.0:
            return {"category": None, "manual_flag": True, "manual_reason": "Manual Review Needed: Over capacity for 28x2x44 box.", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
        return {"category": "28x2x44", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}

    # Banner present (anywhere in type or promo) → 8x8x36 (cannot be STANDARD)
    if hasBanner:
        return {"category": "8x8x36", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}

    # Specific PT rule: if PT present and no types larger than PT → Stay Flat Envelope
    if hasPT and (max_key is not None) and SIZE_INDEX.get(max_key, -1) <= SIZE_INDEX["pump_topper"]:
        return {"category": "Stay Flat Envelope", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}

    # STANDARD via specific large-but-not-big types
    if q["door_24x36"] > 0 or q["windmaster"] > 0:
        return {"category": standard_box_label, "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}

    # Largest item logic; unknown types → STANDARD
    if max_key is None:
        return {"category": standard_box_label, "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}
    if SIZE_INDEX.get(max_key, -1) > SIZE_INDEX["pump_topper"]:
        return {"category": standard_box_label, "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}

    # Envelope categories (only if all known small enough)
    present_keys = { _type_key(canon(it.get("type",""))) for it in (items or []) if _type_key(canon(it.get("type",""))) }
    allowed_wobbler_env = {"nozzle", "wobbler"}
    if present_keys and present_keys.issubset(allowed_wobbler_env) and q["wobbler"] > 0:
        return {"category": "Padded Envelope", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}

    allowed_pack = {"nozzle", "wobbler", "starburst","corner_cooler"}
    if present_keys and present_keys.issubset(allowed_pack) and (q["wobbler"] > 0 or q["starburst"] > 0):
        return {"category": "Padded Pack", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}

    # Stay Flat Envelope: largest <= pump topper
    if SIZE_INDEX.get(max_key, -1) <= SIZE_INDEX["pump_topper"]:
        return {"category": "Stay Flat Envelope", "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}

    return {"category": standard_box_label, "manual_flag": False, "manual_reason": "", "capacity_sum": cap_sum, "hasBanner": hasBanner, "hasPT": hasPT}

# ----------------------------- Store helpers -----------------------------

_STORE_NUM_RE = re.compile(r'[A-Z]\d{4}')

def extract_store_number(store: dict) -> str:
    for key in ("store_name", "store_id"):
        value = store.get(key)
        if not value:
            continue
        m = _STORE_NUM_RE.search(str(value))
        if m:
            return m.group(0)
    meta = store.get('meta') or {}
    value = meta.get('store', '')
    if value:
        m = _STORE_NUM_RE.search(str(value))
        if m:
            return m.group(0)
    return store.get('store_name', '') or ''

def render_store_group(out_doc, src_doc, stores, blackout_cfg, kit_by_store_id, section_title):
    if not stores:
        return
    page = out_doc.new_page()
    page, _ = draw_heading(out_doc, page, section_title, MARGIN_T, fontsize=18)
    current_type = None
    for store in stores:
        kit_name = kit_by_store_id.get(store['store_id'])
        store_type = store.get('store_type', '')
        if store_type != current_type:
            current_type = store_type
            heading = out_doc.new_page()
            heading_text = f"Store Type: {current_type}" if current_type else "Store Type: (Unspecified)"
            heading, _ = draw_heading(out_doc, heading, heading_text, MARGIN_T, fontsize=16)
        for p in store['pages']:
            out_doc.insert_pdf(src_doc, from_page=p, to_page=p)
            pg = out_doc[-1]
            blackout_rows_on_page(pg, blackout_cfg)
            if store.get('drop_nonalc_wobbler'):
                blackout_nonalc_wobbler_row_on_page(pg)
            highlight_keyword(pg, KIT_COUNTER, (0.68, 0.85, 0.90))
            highlight_keyword(pg, KIT_SHIPPER, (1.00, 0.71, 0.76))

            # Highlight any user-defined kit markers (including *_ltd variants) using the same colors.
            try:
                rules = load_custom_rules()
                for needle in _star_tokens_for_actions(rules, {"counter_kit", "counter_kit_ltd"}):
                    highlight_keyword(pg, needle, (0.68, 0.85, 0.90))
                for needle in _star_tokens_for_actions(rules, {"shipper_kit", "shipper_kit_ltd"}):
                    highlight_keyword(pg, needle, (1.00, 0.71, 0.76))
            except Exception:
                dbg_ex("render_store_group custom kit highlights")

            if kit_name:
                annotate_wobbler_kit(pg, kit_name)

# ----------------------------- Wrapped text helpers (no overflow) -----------------------------

def _line_height(fontsize: float, leading: float = LEADING) -> float:
    return fontsize * leading

def draw_wrapped_text(out_doc, page, x, y, text, max_width, fontsize=12, leading=LEADING, color=(0,0,0)):
    x_start = x
    paragraphs = str(text).splitlines() if text else [""]
    for para in paragraphs:
        words = para.split(" ")
        line = ""
        while words:
            peek = (line + (" " if line else "") + words[0]).strip()
            w = fitz.get_text_length(peek, fontname="helv", fontsize=fontsize)
            if w <= max_width:
                line = peek
                words.pop(0)
                if words:
                    continue
            else:
                if not line:
                    forced = words.pop(0)
                    trimmed = _ellipsize_to_width(forced, max_width, fontsize)
                    if trimmed:
                        forced = trimmed
                    line = forced
                else:
                    pass
            if y > page.rect.y1 - MARGIN_B - _line_height(fontsize, leading):
                page = out_doc.new_page()
                x = x_start
                y = MARGIN_T
            page.insert_text((x, y), line, fontsize=fontsize, color=color)
            y += _line_height(fontsize, leading)
            line = ""
        if line:
            if y > page.rect.y1 - MARGIN_B - _line_height(fontsize, leading):
                page = out_doc.new_page()
                x = x_start
                y = MARGIN_T
            page.insert_text((x, y), line, fontsize=fontsize, color=color)
            y += _line_height(fontsize, leading)
    return page, y

def draw_heading(out_doc, page, text, y, fontsize=18):
    max_width = page.rect.x1 - MARGIN_R - MARGIN_L
    page, y = draw_wrapped_text(out_doc, page, MARGIN_L, y, text, max_width, fontsize=fontsize, leading=1.15)
    return page, y

def draw_label_value(out_doc, page, label, value, y, fontsize=12):
    max_width = page.rect.x1 - MARGIN_R - MARGIN_L
    page, y = draw_wrapped_text(out_doc, page, MARGIN_L, y, f"{label}: {value}", max_width, fontsize=fontsize)
    return page, y

def draw_bullets(out_doc, page, items, y, indent=16, fontsize=11):
    max_width = page.rect.x1 - MARGIN_R - MARGIN_L - indent
    for it in items:
        page, y = draw_wrapped_text(out_doc, page, MARGIN_L + indent, y, f"- {it}", max_width, fontsize=fontsize)
    return page, y

def _ellipsize_to_width(text, max_width, fontsize):
    if fitz.get_text_length(text, fontname="helv", fontsize=fontsize) <= max_width:
        return text
    if fitz.get_text_length("…", fontname="helv", fontsize=fontsize) > max_width:
        return ""
    t = text
    while t and fitz.get_text_length(t + "…", fontname="helv", fontsize=fontsize) > max_width:
        t = t[:-1]
    return t + "…"

def draw_multicolumn_list(out_doc, page, items, y, columns=4, fontsize=10, col_gap=20, leading=1.15, header_on_new_pages=None, bullet="- "):
    width_total = page.rect.x1 - MARGIN_R - MARGIN_L
    col_width = (width_total - (columns - 1) * col_gap) / columns
    line_h = _line_height(fontsize, leading)

    i = 0
    while i < len(items):
        rows_fit = int((page.rect.y1 - MARGIN_B - y) // line_h)
        if rows_fit <= 0:
            page = out_doc.new_page()
            y = MARGIN_T
            if header_on_new_pages:
                page, y = draw_wrapped_text(out_doc, page, MARGIN_L, y, header_on_new_pages, width_total, fontsize=12)
            continue

        per_page = rows_fit * columns
        chunk = items[i:i+per_page]
        for r in range(rows_fit):
            for c in range(columns):
                idx = r + c*rows_fit
                if idx >= len(chunk):
                    continue
                name = chunk[idx]
                txt = (bullet + name) if bullet else name
                txt = _ellipsize_to_width(txt, col_width, fontsize)
                x = MARGIN_L + c * (col_width + col_gap)
                y_line = y + r * line_h
                page.insert_text((x, y_line), txt, fontsize=fontsize, color=(0,0,0))

        y += rows_fit * line_h
        i += len(chunk)
        if i < len(items):
            page = out_doc.new_page()
            y = MARGIN_T
            if header_on_new_pages:
                page, y = draw_wrapped_text(out_doc, page, MARGIN_L, y, header_on_new_pages, width_total, fontsize=12)
    return page, y

# ----------------------------- NEW: per-store detection of both wobblers -----------------------------

def store_should_drop_nonalc(items) -> bool:
    has_alc = False
    has_non = False
    for it in items or []:
        if canon(it.get('type','')) != TYPE_SHELF_WOBBLER_CANON:
            continue
        p = canon(it.get('promo',''))
        if p == PROMO_WOBBLER_ALC_CANON:
            has_alc = True
        elif p == PROMO_WOBBLER_NONALC_CANON:
            has_non = True
        if has_alc and has_non:
            return True
    return False

# ----------------------------- Safe save -----------------------------

def ensure_unique_path(path: Path) -> Path:
    if not path.exists():
        return path
    n = 1
    while True:
        cand = path.with_name(f"{path.stem} ({n}){path.suffix}")
        if not cand.exists():
            return cand
        n += 1

# ----------------------------- Main processing -----------------------------

def process_pdf_sorted_with_kits_and_envelopes(
    input_file,
    output_file,
    root=None,
    standard_box_label: Optional[str] = None,
    prompt_starred_rules: bool = True,
):
    dbg(f"process: start input='{input_file}' output='{output_file}'")

    _ = load_blackout_config()
    rules = load_custom_rules()

    # Use effective blackout config (respects enable/disable settings)
    try:
        blackout_cfg = get_effective_blackout_config()
        dbg(f"process: effective blackout rules types={len(blackout_cfg)}")
    except Exception:
        dbg_ex("process: load blackout config")
        blackout_cfg = {}

    # Monthly standard box selector
    try:
        default_std = "8x8x30"
        if standard_box_label:
            std_box = str(standard_box_label).strip() or default_std
        elif root is None:
            std_box = default_std
        else:
            std_box = _ui_askstring(
                "Standard Box",
                "Enter STANDARD box size label for this run (e.g., 8x8x30):",
                initialvalue=default_std,
                parent=root
            )
            if not std_box:
                std_box = default_std
            std_box = str(std_box).strip() or default_std
    except Exception:
        dbg_ex("standard box dialog")
        std_box = "8x8x30"

    t0 = time.time()

    try:
        with fitz.open(input_file) as doc:
            dbg(f"process: pdf pages={len(doc)}")
            # 1) Index stores and extract items
            stores = index_stores(doc)
            for idx, s in enumerate(stores):
                if idx % 20 == 0:
                    dbg(f"process: extracting items for store {idx+1}/{len(stores)}")
                s['items'] = extract_items_from_pages(doc, s['pages'])
                s['drop_nonalc_wobbler'] = store_should_drop_nonalc(s['items'])
                # NEW flags requested:
                s['hasBanner'] = _has_banner(s['items'])
                s['hasPT'] = _has_pump_topper_type(s['items'])
                if DEBUG and s['drop_nonalc_wobbler']:
                    dbg(f"store '{s.get('store_name','?')}' -> drop Non-Alc Wobbler row")

            no_order_stores = [s for s in stores if not s.get('items')]
            stores_with_items = [s for s in stores if s.get('items')]
            dbg(f"process: no_order_stores={len(no_order_stores)} with_items={len(stores_with_items)}")

            # 1b) Prompt on any *STARRED* text we don't know how to handle
            try:
                unhandled_starred = _collect_unhandled_starred_tokens(stores_with_items, rules)
                if unhandled_starred:
                    preview = "\n".join(
                        [f"- {x['token']} (field={x['field']}, store={x['store']})" for x in unhandled_starred[:12]]
                    )
                    more = "" if len(unhandled_starred) <= 12 else f"\n...and {len(unhandled_starred) - 12} more"
                    msg = (
                        "Unhandled *STARRED* text was found in the PDF.\n\n"
                        "This can cause unexpected counting/boxing results because the program doesn't know what the token means yet.\n\n"
                        "Examples:\n"
                        f"{preview}{more}\n\n"
                        "Would you like to add handling rules now?"
                    )
                    if prompt_starred_rules and _ui_yesno("Unhandled Starred Text", msg, parent=root, default=False):
                        rules = _prompt_add_starred_rules(root, unhandled_starred, rules)
            except Exception:
                dbg_ex("unhandled starred prompt")

            # 2) Wobbler kits
            kits, kit_by_store_id = group_wobbler_kits(stores_with_items, min_stores=10)

            # 3) Box/Envelope classification per order (authoritative)
            counts = {
                "28x2x44": 0,
                "8x8x36": 0,
                std_box: 0,
                "Padded Envelope": 0,
                "Padded Pack": 0,
                "Stay Flat Envelope": 0,
            }
            manual_flags = []  # list of (store_display, reason)
            bucket_manual = []  # <-- NEW: keep manual-review stores for rendering

            bucket_boxes_28 = []
            bucket_boxes_8836 = []
            bucket_boxes_std = []
            bucket_env_pe = []
            bucket_env_pp = []
            bucket_env_sfe = []

            for s in stores_with_items:
                result = analyze_order_boxing(s['items'], standard_box_label=std_box)
                # keep flags on store for downstream / debugging if needed
                s['hasBanner'] = result.get("hasBanner", False)
                s['hasPT'] = result.get("hasPT", False)

                cat = result["category"]
                # Store box_category on the store dict for tiered sorting
                s['box_category'] = cat if not result["manual_flag"] else "Manual Review"
                
                if result["manual_flag"]:
                    store_disp = extract_store_number(s) or s.get("store_name","")
                    reason = f"{store_disp} — {result['manual_reason']} (sum={result['capacity_sum']:.1f})"
                    manual_flags.append(reason)
                    s['manual_reason'] = result['manual_reason']
                    s['capacity_sum'] = result['capacity_sum']
                    bucket_manual.append(s)  # <-- keep for output
                    continue
                if not cat:
                    continue
                counts[cat] = counts.get(cat, 0) + 1
                if cat == "28x2x44":
                    bucket_boxes_28.append(s)
                elif cat == "8x8x36":
                    bucket_boxes_8836.append(s)
                elif cat == std_box:
                    bucket_boxes_std.append(s)
                elif cat == "Padded Envelope":
                    bucket_env_pe.append(s)
                elif cat == "Padded Pack":
                    bucket_env_pp.append(s)
                elif cat == "Stay Flat Envelope":
                    bucket_env_sfe.append(s)

            # Sort helper - uses configurable tiered sort order
            sort_cfg = load_sort_order_config()
            use_tiered = sort_cfg.get("use_tiered_sort", True)
            tiered_cfg = sort_cfg.get("tiered_sort", _DEFAULT_TIERED_SORT)
            
            if use_tiered:
                # Use the new tiered sorting system
                def store_sort_key(s):
                    return _get_tiered_sort_key(s, tiered_cfg)
            else:
                # Legacy sorting
                type_rank = get_store_type_rank()
                use_location = sort_cfg.get("sort_by_location", True)
                use_store_name = sort_cfg.get("sort_by_store_name", True)
                
                def store_sort_key(s):
                    rank = type_rank.get(s['store_type'], 999)
                    loc = s.get('location', '') if use_location else ''
                    name = s.get('store_name', '') if use_store_name else ''
                    return (rank, loc, name)

            bucket_boxes_28.sort(key=store_sort_key)
            bucket_boxes_8836.sort(key=store_sort_key)
            bucket_boxes_std.sort(key=store_sort_key)
            bucket_env_pe.sort(key=store_sort_key)
            bucket_env_pp.sort(key=store_sort_key)
            bucket_env_sfe.sort(key=store_sort_key)
            bucket_manual.sort(key=store_sort_key)  # <-- sort manual section too

            # 4) Build output
            out = fitz.open()

            # No-order list
            no_order_display = []
            seen_no_order = set()
            for store in no_order_stores:
                candidate = extract_store_number(store).strip()
                if not candidate:
                    candidate = (store.get('store_name') or '').strip()
                if candidate and candidate not in seen_no_order:
                    seen_no_order.add(candidate)
                    no_order_display.append(candidate)
            no_order_line = ", ".join(no_order_display) if no_order_display else "None"

            # Summary page (no separate "Envelope-Fit Stores")
            cover = out.new_page()
            y = MARGIN_T
            cover, y = draw_heading(out, cover, "Order Packaging Summary", y, fontsize=18)
            cover, y = draw_wrapped_text(out, cover, MARGIN_L, y, f"No Order Stores: {no_order_line}", cover.rect.x1 - MARGIN_R - MARGIN_L, fontsize=12)

            cover, y = draw_label_value(out, cover, "28×2×44 Boxes", counts["28x2x44"], y, fontsize=12)
            cover, y = draw_label_value(out, cover, "8×8×36 Boxes (Banner-only or Banner present)", counts["8x8x36"], y, fontsize=12)
            cover, y = draw_label_value(out, cover, f"Standard Boxes ({std_box})", counts[std_box], y, fontsize=12)
            cover, y = draw_label_value(out, cover, "Padded Envelope Stores", counts["Padded Envelope"], y, fontsize=12)
            cover, y = draw_label_value(out, cover, "Padded Pack Stores", counts["Padded Pack"], y, fontsize=12)
            cover, y = draw_label_value(out, cover, "Stay Flat Envelope Stores", counts["Stay Flat Envelope"], y, fontsize=12)

            cover, y = draw_label_value(out, cover, "Wobbler Kits (10+ stores)", len(kits), y, fontsize=12)
            if DEBUG:
                cover, y = draw_wrapped_text(out, cover, MARGIN_L, y, f"DEBUG log: {os.path.abspath(DEBUG_LOG)}", cover.rect.x1 - MARGIN_R - MARGIN_L, fontsize=8)

            # Manual Review page (list)
            if manual_flags:
                mr = out.new_page()
                yy = MARGIN_T
                mr, yy = draw_heading(out, mr, "Manual Review Needed: Over capacity for 28×2×44 box", yy, fontsize=16)
                mr, yy = draw_bullets(out, mr, manual_flags, yy, indent=16, fontsize=11)

            # Check if box_category tier is enabled to determine rendering approach
            box_category_tier = next((t for t in tiered_cfg.get("tiers", []) if t.get("field") == "box_category"), None)
            box_category_enabled = box_category_tier.get("enabled", True) if box_category_tier else True

            if box_category_enabled:
                # Render stores grouped by box/envelope category (original behavior)
                # ---------------- NEW: Render the actual pages for manual-review stores ----------------
                # So they are NOT dropped from the organized output.
                if bucket_manual:
                    render_store_group(out, doc, bucket_manual, blackout_cfg, kit_by_store_id,
                                       "MANUAL REVIEW NEEDED — 28×2×44 Over-Capacity")

                # Envelope sections
                render_store_group(out, doc, bucket_env_pe,  blackout_cfg, kit_by_store_id, "ENVELOPE — PADDED ENVELOPE")
                render_store_group(out, doc, bucket_env_pp,  blackout_cfg, kit_by_store_id, "ENVELOPE — PADDED PACK")
                render_store_group(out, doc, bucket_env_sfe, blackout_cfg, kit_by_store_id, "ENVELOPE — STAY FLAT")

                # Box sections
                render_store_group(out, doc, bucket_boxes_28,  blackout_cfg, kit_by_store_id, "BOX STORES — 28×2×44")
                render_store_group(out, doc, bucket_boxes_8836, blackout_cfg, kit_by_store_id, "BOX STORES — 8×8×36 (Banner present)")
                render_store_group(out, doc, bucket_boxes_std,  blackout_cfg, kit_by_store_id, f"BOX STORES — STANDARD ({std_box})")
            else:
                # Box category tier disabled - render all stores together without category separation
                all_sorted_stores = (bucket_manual + bucket_env_pe + bucket_env_pp + bucket_env_sfe +
                                     bucket_boxes_28 + bucket_boxes_8836 + bucket_boxes_std)
                all_sorted_stores.sort(key=store_sort_key)
                render_store_group(out, doc, all_sorted_stores, blackout_cfg, kit_by_store_id, "ALL STORES")

            # Wobbler kits appendix
            cover2 = out.new_page()
            y = MARGIN_T
            cover2, y = draw_heading(out, cover2, "Wobbler Kits (Post-Determined, 10+ stores)", y, fontsize=18)
            excluded_list = ", ".join(sorted(_PREDETERMINED_WOBBLERS_CANON))
            cover2, y = draw_wrapped_text(out, cover2, MARGIN_L, y, f"Excluded (predetermined): {excluded_list}", cover2.rect.x1 - MARGIN_R - MARGIN_L, fontsize=10)
            if kits:
                for kit in kits:
                    cover2, y = draw_wrapped_text(out, cover2, MARGIN_L, y, f"{kit['kit_name']}: {kit['store_count']} stores", cover2.rect.x1 - MARGIN_R - MARGIN_L, fontsize=12)
            else:
                cover2, y = draw_wrapped_text(out, cover2, MARGIN_L, y, "No kits reached the 10+ store threshold.", cover2.rect.x1 - MARGIN_R - MARGIN_L, fontsize=12)

            for kit in kits:
                page = out.new_page()
                y = MARGIN_T
                page, y = draw_heading(out, page, f"{kit['kit_name']}  —  {kit['store_count']} stores", y, fontsize=16)
                page, y = draw_wrapped_text(out, page, MARGIN_L, y, "Items:", page.rect.x1 - MARGIN_R - MARGIN_L, fontsize=12)
                item_lines = [f"{it['promo']}  (qty {it['qty']})" for it in kit['items']]
                page, y = draw_bullets(out, page, item_lines, y, indent=16, fontsize=11)
                if y > page.rect.y1 - MARGIN_B - _line_height(12):
                    page = out.new_page(); y = MARGIN_T
                page, y = draw_wrapped_text(out, page, MARGIN_L, y, "Stores:", page.rect.x1 - MARGIN_R - MARGIN_L, fontsize=12)
                page, y = draw_multicolumn_list(out_doc=out, page=page, items=kit['stores'], y=y,
                                                columns=4, fontsize=10, col_gap=20, leading=1.1,
                                                header_on_new_pages="Stores (cont.)", bullet="- ")

            # Save
            out_path = ensure_unique_path(Path(output_file))
            out.save(out_path.as_posix()); out.close()
    except Exception:
        dbg_ex("process: outer")
        _ui_error("Error", "A fatal error occurred. See kwik_debug.log for details.", parent=root)
        return

    dt = time.time() - t0
    dbg(f"process: done in {dt:.2f}s")
    _ui_info(
        "Complete",
        f"Saved: {out_path}\n"
        f"28x2x44 Boxes: {counts['28x2x44']}\n"
        f"8x8x36 Boxes: {counts['8x8x36']}\n"
        f"Standard Boxes ({std_box}): {counts[std_box]}\n"
        f"Padded Envelope: {counts['Padded Envelope']}\n"
        f"Padded Pack: {counts['Padded Pack']}\n"
        f"Stay Flat Envelope: {counts['Stay Flat Envelope']}\n"
        f"No Order Stores: {len(no_order_stores)}\n"
        f"Manual Reviews: {len(bucket_manual)}\n"
        f"Wobbler Kits (10+): {len(kits)}",
        parent=root
    )

# ----------------------------- App wiring -----------------------------

def main_cli(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Kwik Fill sorter (terminal mode). Generates a sorted PDF with packaging sections and wobbler kit appendix."
    )
    parser.add_argument("input_pdf", help="Input PDF path")
    parser.add_argument(
        "output_pdf",
        nargs="?",
        default=None,
        help="Output PDF path (default: <input folder>\\sorted.pdf)",
    )
    parser.add_argument(
        "--std-box",
        dest="std_box",
        default=None,
        help="Standard box label for this run (default: 8x8x30)",
    )
    parser.add_argument(
        "--no-star-prompts",
        action="store_true",
        help="Do not prompt to create rules for unhandled *STARRED* tokens",
    )

    args = parser.parse_args(argv)

    input_pdf = Path(args.input_pdf)
    output_pdf = Path(args.output_pdf) if args.output_pdf else input_pdf.with_name("sorted.pdf")
    if not input_pdf.exists():
        _ui_error("CLI", f"Input PDF not found: {input_pdf}")
        return 2

    process_pdf_sorted_with_kits_and_envelopes(
        str(input_pdf),
        str(output_pdf),
        root=None,
        standard_box_label=args.std_box,
        prompt_starred_rules=not args.no_star_prompts,
    )
    return 0


def main_cli_interactive() -> int:
    _ui_info(
        "KwikFill",
        "Terminal mode (no Tk GUI).\n\n"
        "Tip: you can drag-and-drop a PDF onto the .exe to run it with arguments.",
        parent=None,
    )

    while True:
        inp = _ui_askstring("Input", "Enter input PDF path:", initialvalue="", parent=None)
        if not inp:
            _ui_error("Input", "No input path provided.", parent=None)
            return 2
        input_pdf = Path(str(inp).strip().strip('"'))
        if input_pdf.exists():
            break
        _ui_error("Input", f"File not found: {input_pdf}", parent=None)

    out_default = str(input_pdf.with_name("sorted.pdf"))
    outp = _ui_askstring("Output", "Enter output PDF path:", initialvalue=out_default, parent=None)
    output_pdf = Path(str(outp).strip().strip('"')) if outp else Path(out_default)

    std_box = _ui_askstring("Standard Box", "Enter STANDARD box size label:", initialvalue="8x8x30", parent=None)
    std_box = (std_box or "8x8x30").strip()

    process_pdf_sorted_with_kits_and_envelopes(
        str(input_pdf),
        str(output_pdf),
        root=None,
        standard_box_label=std_box,
        prompt_starred_rules=True,
    )
    return 0

def main():
    if DEBUG:
        try:
            with open(DEBUG_LOG, "w", encoding="utf-8") as f:
                f.write(f"KWIK DEBUG LOG — {datetime.now().isoformat()}\n")
        except Exception:
            pass
        dbg("main: debug enabled")

    # If arguments are provided, prefer terminal mode.
    if len(sys.argv) > 1:
        return main_cli(sys.argv[1:])

    # Otherwise, try GUI mode; fall back to interactive CLI if Tk can't initialize.
    if not _TK_IMPORT_OK or tk is None:
        _ui_error(
            "Tkinter",
            "Tkinter is not available. Run from terminal with: python KFSORT1.0.py <input.pdf> [output.pdf]",
        )
        return main_cli_interactive()

    try:
        root = tk.Tk(className="KwikFill")
    except Exception:
        dbg_ex("main: tk init")
        _ui_error(
            "Tkinter",
            "Tk could not initialize. Falling back to terminal mode.\n\n"
            "Usage: python KFSORT1.0.py <input.pdf> [output.pdf]",
        )
        return main_cli_interactive()
    try:
        root.withdraw()
        root.update_idletasks()
    except Exception:
        dbg_ex("main root init")

    try:
        input_file = filedialog.askopenfilename(
            title="Select the Kwik-Fill PDF",
            filetypes=[("PDF files", "*.pdf")],
            parent=root
        )
        dbg(f"main: input_file='{input_file}'")
        if not input_file:
            messagebox.showerror("Error", "No input file selected.", parent=root)
            root.destroy(); return

        output_file = filedialog.asksaveasfilename(
            title="Save processed PDF as",
            defaultextension=".pdf",
            filetypes=[("PDF files", "*.pdf")],
            parent=root
        )
        dbg(f"main: output_file='{output_file}'")
        if not output_file:
            messagebox.showerror("Error", "No output file selected.", parent=root)
            root.destroy(); return

        try:
            if messagebox.askyesno("Blackout", "Delete existing blackout entries?", parent=root):
                gui_blackout_delete(root)
            if messagebox.askyesno("Blackout", "Add / edit blackout entries now?", parent=root):
                gui_blackout_edit(root)
            if messagebox.askyesno("Blackout Settings", "Configure blackout enable/disable settings?", parent=root):
                gui_blackout_settings(root)
            if messagebox.askyesno("Sort Order", "Configure store type sort order?", parent=root):
                gui_sort_order_edit(root)
        except Exception:
            dbg_ex("main blackout prompts")

        process_pdf_sorted_with_kits_and_envelopes(input_file, output_file, root)
    except Exception:
        dbg_ex("main outer")
        _ui_error("Error", "Unexpected error. See kwik_debug.log.", parent=root)
    finally:
        try:
            root.destroy()
        except Exception:
            pass
    return 0

if __name__ == "__main__":
    sys.exit(main() or 0)
