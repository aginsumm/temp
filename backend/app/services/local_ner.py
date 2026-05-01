"""
本地 NER（命名实体识别）服务
使用规则匹配 + 关键词库实现快速实体提取（<100ms）
避免每次调用 AI API，提升性能
"""
import re
from typing import List, Dict, Tuple
from app.schemas.chat import Entity, EntityType
from app.services.entity_quality import is_spurious_period_entity_name


# ========== 非遗领域实体词库 ==========

# 传承人关键词
INHERITOR_KEYWORDS = [
    "传承人", "大师", "艺人", "工匠", "匠人", "师傅", "老师", "先生", "女士",
    "国家级传承人", "省级传承人", "市级传承人", "代表性传承人"
]

# 技艺关键词
TECHNIQUE_KEYWORDS = [
    "刺绣", "木雕", "剪纸", "陶艺", "编织", "雕刻", "绘画", "书法", "泥塑",
    "漆器", "瓷器", "织锦", "蜡染", "扎染", "银饰", "铜器", "竹编", "草编",
    "苏绣", "湘绣", "粤绣", "蜀绣", "汉绣", "京绣", "鲁绣", "杭绣",
    "浮雕", "圆雕", "镂空雕", "透雕", "线雕", "影雕",
]

# 地区关键词（中国主要省市）
REGION_KEYWORDS = [
    # 省份
    "北京", "天津", "上海", "重庆",
    "河北", "山西", "辽宁", "吉林", "黑龙江",
    "江苏", "浙江", "安徽", "福建", "江西", "山东",
    "河南", "湖北", "湖南", "广东", "海南",
    "四川", "贵州", "云南", "陕西", "甘肃", "青海",
    "台湾", "内蒙古", "广西", "西藏", "宁夏", "新疆", "香港", "澳门",
    # 主要城市
    "苏州", "杭州", "南京", "武汉", "成都", "西安", "广州", "深圳",
    "景德镇", "宜兴", "佛山", "潮州", "泉州", "福州", "厦门"
]

# 时期关键词
PERIOD_KEYWORDS = [
    # 朝代
    "夏朝", "商朝", "周朝", "春秋", "战国", "秦朝", "汉朝", "三国", "晋朝",
    "南北朝", "隋朝", "唐朝", "宋朝", "元朝", "明朝", "清朝",
    "唐代", "宋代", "元代", "明代", "清代",
    # 时期
    "古代", "近代", "现代", "当代", "民国", "新中国",
    # 世纪
    "世纪", "年代"
]

# 材料关键词
MATERIAL_KEYWORDS = [
    "丝", "绸", "棉", "麻", "毛", "皮", "革",
    "木", "竹", "藤", "草", "柳",
    "陶", "瓷", "泥", "土",
    "金", "银", "铜", "铁", "锡",
    "玉", "石", "水晶", "琉璃",
    "纸", "墨", "颜料", "染料", "漆"
]

# 纹样关键词
PATTERN_KEYWORDS = [
    "龙纹", "凤纹", "龙凤纹", "云纹", "回纹", "卷草纹", "莲花纹",
    "牡丹纹", "菊花纹", "梅花纹", "竹纹", "兰花纹",
    "如意纹", "寿字纹", "福字纹", "喜字纹",
    "几何纹", "图腾",
]

# 作品关键词
WORK_KEYWORDS = [
    "作品", "代表作", "名作", "精品", "杰作",
    "画作", "雕塑", "器物", "器具", "用具",
    "服饰", "建筑", "家具", "摆件", "饰品"
]


class LocalNER:
    """本地命名实体识别器"""

    def __init__(self):
        # 编译正则表达式（提升性能）
        self.person_pattern = re.compile(r'[\u4e00-\u9fa5]{2,4}(?:先生|女士|大师|老师|师傅)')
        self.year_pattern = re.compile(r'\d{3,4}年')
        self.dynasty_pattern = re.compile(r'(夏|商|周|秦|汉|晋|隋|唐|宋|元|明|清)(朝|代)')

    def extract(self, text: str) -> List[Entity]:
        """
        快速提取实体（<100ms）

        Args:
            text: 输入文本

        Returns:
            List[Entity]: 提取的实体列表
        """
        entities = []
        seen_names = set()  # 去重

        # 1. 提取传承人（人名 + 称谓）
        for match in self.person_pattern.finditer(text):
            name = match.group()
            if name not in seen_names:
                entities.append(self._create_entity(
                    name=name,
                    entity_type=EntityType.inheritor,
                    description=f"非遗传承人或相关人物",
                    relevance=0.85
                ))
                seen_names.add(name)

        # 2. 提取技艺
        for keyword in TECHNIQUE_KEYWORDS:
            if keyword in text and keyword not in seen_names:
                entities.append(self._create_entity(
                    name=keyword,
                    entity_type=EntityType.technique,
                    description=f"传统技艺或工艺",
                    relevance=0.90
                ))
                seen_names.add(keyword)

        # 3. 提取地区
        for keyword in REGION_KEYWORDS:
            if keyword in text and keyword not in seen_names:
                entities.append(self._create_entity(
                    name=keyword,
                    entity_type=EntityType.region,
                    description=f"地理位置或区域",
                    relevance=0.88
                ))
                seen_names.add(keyword)

        # 4. 提取时期
        # 4.1 朝代
        for match in self.dynasty_pattern.finditer(text):
            name = match.group()
            if name not in seen_names:
                entities.append(self._create_entity(
                    name=name,
                    entity_type=EntityType.period,
                    description=f"历史朝代或时期",
                    relevance=0.92
                ))
                seen_names.add(name)

        # 4.2 年份（排除「超过2300年」等历时统计中的数字+年）
        for match in self.year_pattern.finditer(text):
            name = match.group()
            if name in seen_names:
                continue
            start, end = match.start(), match.end()
            window = text[max(0, start - 8) : min(len(text), end + 4)]
            if is_spurious_period_entity_name(window) or is_spurious_period_entity_name(name):
                continue
            try:
                y = int(name.replace("年", ""))
            except ValueError:
                continue
            if y >= 2000:
                continue
            entities.append(self._create_entity(
                name=name,
                entity_type=EntityType.period,
                description=f"具体年份",
                relevance=0.85
            ))
            seen_names.add(name)

        # 4.3 时期关键词
        for keyword in PERIOD_KEYWORDS:
            if keyword in text and keyword not in seen_names:
                entities.append(self._create_entity(
                    name=keyword,
                    entity_type=EntityType.period,
                    description=f"历史时期",
                    relevance=0.80
                ))
                seen_names.add(keyword)

        # 5. 提取材料
        for keyword in MATERIAL_KEYWORDS:
            if keyword in text and keyword not in seen_names:
                entities.append(self._create_entity(
                    name=keyword,
                    entity_type=EntityType.material,
                    description=f"传统材料或原料",
                    relevance=0.82
                ))
                seen_names.add(keyword)

        # 6. 提取纹样
        for keyword in PATTERN_KEYWORDS:
            if keyword in text and keyword not in seen_names:
                entities.append(self._create_entity(
                    name=keyword,
                    entity_type=EntityType.pattern,
                    description=f"传统图案或纹样",
                    relevance=0.80
                ))
                seen_names.add(keyword)

        # 7. 提取作品
        for keyword in WORK_KEYWORDS:
            if keyword in text and keyword not in seen_names:
                # 尝试提取作品名称（书名号内容）
                book_title_pattern = re.compile(r'《([^》]+)》')
                for match in book_title_pattern.finditer(text):
                    work_name = match.group(1)
                    if work_name not in seen_names:
                        entities.append(self._create_entity(
                            name=work_name,
                            entity_type=EntityType.work,
                            description=f"非遗相关作品",
                            relevance=0.88
                        ))
                        seen_names.add(work_name)

        # 按相关性排序（不设条数上限，后续由 entity_quality 过滤/合并）
        entities.sort(key=lambda e: e.relevance, reverse=True)
        return entities

    def _create_entity(
        self,
        name: str,
        entity_type: EntityType,
        description: str,
        relevance: float
    ) -> Entity:
        """创建实体对象"""
        import hashlib
        from datetime import datetime

        # 生成一致的 ID
        key = f"{name.lower().strip()}_{entity_type.value}"
        hash_value = hashlib.md5(key.encode()).hexdigest()[:12]
        entity_id = f"ent_{hash_value}"

        return Entity(
            id=entity_id,
            name=name,
            type=entity_type,
            description=description,
            relevance=relevance,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )


# 单例
local_ner = LocalNER()
