"""
聊天侧实体质量：过滤「技法/针法」等统称、合并「某某老师 / 某某大师」等尊称变体。
供 chat 去重与 llm_service 合并后调用，避免图谱节点过碎、过泛；不设节点数量上限。
"""

from __future__ import annotations

import hashlib
import re
from typing import Any

# 禁止作为「技艺」节点单独出现的统称（与具体项目名如「苏绣」「乱针绣」区分）
GENERIC_TECHNIQUE_NAMES: frozenset[str] = frozenset(
    {
        "技法",
        "针法",
        "工艺",
        "技艺",
        "手艺",
        "做法",
        "工序",
        "流程",
        "手法",
        "诀窍",
        "窍门",
        "绝招",
        "传统技法",
        "各种技法",
        "核心工艺",
        "传统工艺",
        "制作工艺",
        "加工技艺",
        "操作技法",
        "绣花工艺",
        "印染工艺",
    }
)

# 禁止作为「作品」节点的笼统词
GENERIC_WORK_NAMES: frozenset[str] = frozenset(
    {
        "作品",
        "代表作",
        "名作",
        "精品",
        "杰作",
        "画作",
        "器物",
        "某作品",
        "这件作品",
        "该作品",
        "相关作品",
        "代表作品",
        "经典作品",
        "传世作品",
    }
)

_INHERITOR_PREFIX = re.compile(
    r"^(?:著名|国家级|省级|市级|县级|青年|民间|工艺美术|非遗|传承)\s*"
)
_INHERITOR_SUFFIX = re.compile(
    r"(?:老师|大师|先生|女士|师傅|匠人|工匠|艺人|传承人|"
    r"代表性传承人|工艺美术师|工艺师|同志|前辈)$"
)


def generate_entity_id(name: str, entity_type: str) -> str:
    """与 chat.py 一致：基于规范化名称 + 类型生成稳定 id。"""
    key = f"{name.lower().strip()}_{entity_type}"
    hash_value = hashlib.md5(key.encode()).hexdigest()[:12]
    return f"ent_{hash_value}"


def strip_markdown_asterisk(name: str) -> str:
    return re.sub(r"\*+", "", name or "").strip()


_WRAPPERS: tuple[tuple[str, str], ...] = (
    ("《", "》"),
    ("「", "」"),
    ("『", "』"),
)


def canonical_title_surface(name: str) -> str:
    """
    作品/纹样：`《黄鹤楼》、黄鹤楼、《**黄鹤楼**》`、`  **黄鹤楼**  ` 归为同一字面核，用于合并节点与匹配备选名。
    只剥 **整串** 外层的书名号/引号，不破坏「汉剧《黄鹤楼》」类复合名。
    """
    n = strip_markdown_asterisk(name or "")
    n = re.sub(r"[\s\u3000]+", " ", n).strip()
    if not n:
        return ""
    changed = True
    while changed:
        changed = False
        for open_b, close_b in _WRAPPERS:
            if len(n) >= 2 and n.startswith(open_b) and n.endswith(close_b):
                inner = n[len(open_b) : -len(close_b)].strip()
                if inner:
                    n = inner
                    changed = True
                    break
    return re.sub(r"[\s\u3000]+", " ", strip_markdown_asterisk(n)).strip()


def iter_title_aliases_for_graph(name: str, entity_kind: str) -> list[str]:
    """图谱/解析：同作品（或纹样）的可选字面，用于连线端点名命中。"""
    if entity_kind not in ("work", "pattern"):
        return []
    raw = (name or "").strip()
    core = canonical_title_surface(raw)
    if not raw and not core:
        return []
    bag: set[str] = set()
    for x in (raw, core, strip_markdown_asterisk(raw), strip_markdown_asterisk(core)):
        if len(x.strip()) >= 1:
            bag.add(x.strip())
    if len(core) >= 1:
        for op, cl in _WRAPPERS:
            bag.add(f"{op}{core}{cl}")
        compact_c = re.sub(r"[\s\u3000《》「」『』]", "", core)
        if len(compact_c) >= 1:
            bag.add(compact_c)
        raw_cmp = re.sub(r"[\s\u3000《》「」『』]", "", raw)
        if len(raw_cmp) >= 1:
            bag.add(raw_cmp)
    return sorted(bag, key=len, reverse=True)


def strip_inheritor_honorifics(name: str) -> str:
    """去掉传承人姓名前后常见职务/尊称，用于合并「张三老师」「张三大师」。"""
    n = (name or "").strip()
    if not n:
        return ""
    n = _INHERITOR_PREFIX.sub("", n).strip()
    prev = None
    while prev != n:
        prev = n
        n = _INHERITOR_SUFFIX.sub("", n).strip()
    return n


def _etype_str(entity: Any) -> str:
    t = getattr(entity, "type", None)
    return t.value if hasattr(t, "value") else str(t or "")


def is_spurious_period_entity_name(name: str) -> bool:
    """
    非「历史时期/朝代」类表述，不应标为 period：
    - 「超过/长达…2300年」等历时统计；
    - 「两千余年」「300多年」等时长；
    - 裸「2300年」「2024年」等四位及以上公元纪年片段（易与朝代名混淆）。
    """
    n = (name or "").strip()
    if not n:
        return False
    compact = re.sub(r"[\s\u3000]+", "", n)

    if re.search(r"(超过|长达|逾|不少于|多于|将近|约|至少)\s*\d{2,}\s*年", n):
        return True
    if re.search(r"\d{2,}\s*年\s*(的\s*)?历史", n):
        return True
    if re.search(r"\d{2,}\s*年之久", n):
        return True
    if re.search(r"\d{3,}\s*余年", n) or re.search(r"\d{3,}余年", compact):
        return True
    if re.search(r"\d{3,}\s*多年", n) or re.search(r"\d{3,}多年", compact):
        return True
    if re.search(r"\d{2,}\s*多\s*个\s*世纪", n):
        return True

    m4 = re.fullmatch(r"(\d{4,})年", compact)
    if m4 and int(m4.group(1)) >= 2000:
        return True

    return False


def entity_merge_key(entity: Any) -> str:
    """去重主键：传承人按去掉尊称后的姓名合并；作品/纹样按去书名号/markdown 后的字面核合并。"""
    name = (getattr(entity, "name", None) or "").strip()
    if not name:
        return ""
    et = _etype_str(entity)
    if et == "inheritor":
        base = strip_inheritor_honorifics(name)
        if len(base) >= 2:
            return f"inheritor::{base.casefold()}"
    if et == "work":
        core = canonical_title_surface(name)
        if len(core) >= 2:
            return f"work::{core.casefold()}"
    if et == "pattern":
        core = canonical_title_surface(name)
        if len(core) >= 2:
            return f"pattern::{core.casefold()}"
    return f"{name.casefold()}_{et}"


def is_low_quality_entity(entity: Any) -> bool:
    """过滤过短、统称类技艺/作品名。"""
    raw = getattr(entity, "name", None)
    name = (raw or "").strip() if isinstance(raw, str) else str(raw or "").strip()
    if len(name) < 2:
        return True

    et = _etype_str(entity)
    compact = re.sub(r"[\s\u3000]+", "", name)

    if et == "technique":
        if name in GENERIC_TECHNIQUE_NAMES or compact in GENERIC_TECHNIQUE_NAMES:
            return True

    if et == "work":
        if name in GENERIC_WORK_NAMES or compact in GENERIC_WORK_NAMES:
            return True
        if re.fullmatch(r"(一件|这件|该|某).{0,4}作品", name):
            return True

    if et == "pattern":
        if name in frozenset({"图案", "花纹", "纹饰", "纹样"}):
            return True

    if et == "period" and is_spurious_period_entity_name(name):
        return True

    return False


def _pick_better_entity(a: Any, b: Any) -> Any:
    ra = float(getattr(a, "relevance", None) or 0.0)
    rb = float(getattr(b, "relevance", None) or 0.0)
    if rb > ra:
        return b
    if ra > rb:
        return a
    # 相关度相同时优先保留有更完整简述的一方，避免合并后整条 description 为空
    da = len(str((getattr(a, "description", None) or "")).strip())
    db = len(str((getattr(b, "description", None) or "")).strip())
    return b if db > da else a


def fallback_description_after_merge(entity_type: str, display_name: str) -> str:
    """
    大模型偶有漏写 description；合并桶内也可能全是空。兜底与 local_ner 语义对齐，仅占位≠模型级阐述。
    """
    dn = (display_name or "").strip()
    t = entity_type or "technique"
    if t == "inheritor":
        return "非遗传承人或相关人物"
    if t == "technique":
        return "传统技艺或工艺"
    if t == "work":
        if dn:
            return f"对话涉及的作品或文献实体：{dn}"[:100]
        return "非遗相关作品或文献"
    if t == "pattern":
        return "传统图案或纹样"
    if t == "region":
        return "地理位置或区域"
    if t == "period":
        return "历史朝代或时期"
    if t == "material":
        return "传统材料或原料"
    return f"对话中出现的实体：{dn}"[:100] if dn else "对话相关实体"


def _merged_display_name(entities: list, et: str) -> str:
    """同一组合并后的展示名：传承人用去尊称规范名，其余保留信息量较大的原名。"""
    if et == "inheritor":
        bases = [strip_inheritor_honorifics((getattr(e, "name", None) or "").strip()) for e in entities]
        bases = [b for b in bases if len(b) >= 2]
        if bases:
            return max(bases, key=len)
        return (getattr(entities[0], "name", None) or "").strip()
    names = [(getattr(e, "name", None) or "").strip() for e in entities]
    names = [n for n in names if n]
    if et in ("work", "pattern"):
        core = canonical_title_surface(names[0])
        for n in sorted(names, key=len):
            if canonical_title_surface(n) == core and "《" in n and "》" in n:
                return strip_markdown_asterisk(n)
        return strip_markdown_asterisk(max(names, key=lambda x: len(strip_markdown_asterisk(x))))
    return max(names, key=len) if names else ""


def refine_chat_entities(entities: list) -> list:
    """
    过滤低质量实体 → 按 merge_key 合并 → 重算 id → 按相关度排序。
    """
    if not entities:
        return []

    filtered = [e for e in entities if not is_low_quality_entity(e)]
    if not filtered:
        return []

    buckets: dict[str, list] = {}
    for e in filtered:
        k = entity_merge_key(e)
        if not k:
            continue
        buckets.setdefault(k, []).append(e)

    merged: list = []
    for _key, group in buckets.items():
        best = group[0]
        for other in group[1:]:
            best = _pick_better_entity(best, other)
        et = _etype_str(best)
        display = _merged_display_name(group, et)
        if not display:
            display = (getattr(best, "name", None) or "").strip()

        out = best
        out.name = display
        out.id = generate_entity_id(display, et)
        # 合并描述
        descs = [getattr(x, "description", None) for x in group if getattr(x, "description", None)]
        descs = [d for d in descs if isinstance(d, str) and d.strip()]
        if descs:
            longest = max(descs, key=len)
            if not getattr(out, "description", None) or len(longest) > len(out.description or ""):
                out.description = longest

        cur_d = getattr(out, "description", None)
        if not isinstance(cur_d, str) or not cur_d.strip():
            out.description = fallback_description_after_merge(et, display)

        merged.append(out)

    merged.sort(key=lambda e: float(getattr(e, "relevance", None) or 0.0), reverse=True)
    return merged
