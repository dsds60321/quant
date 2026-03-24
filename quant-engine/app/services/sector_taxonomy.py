from __future__ import annotations

from typing import Iterable


STANDARD_SECTOR_LABELS = (
    "정보기술",
    "금융",
    "헬스케어",
    "산업재",
    "경기소비재",
    "필수소비재",
    "커뮤니케이션서비스",
    "소재",
    "에너지",
    "유틸리티",
    "부동산",
    "ETF",
)

_DIRECT_ALIASES = {
    "technology": "정보기술",
    "information technology": "정보기술",
    "tech": "정보기술",
    "financial services": "금융",
    "financial": "금융",
    "healthcare": "헬스케어",
    "health care": "헬스케어",
    "industrials": "산업재",
    "industrial goods": "산업재",
    "consumer cyclical": "경기소비재",
    "consumer discretionary": "경기소비재",
    "consumer defensive": "필수소비재",
    "consumer staples": "필수소비재",
    "communication services": "커뮤니케이션서비스",
    "communication service": "커뮤니케이션서비스",
    "basic materials": "소재",
    "materials": "소재",
    "energy": "에너지",
    "utilities": "유틸리티",
    "real estate": "부동산",
    "realestate": "부동산",
    "reit": "부동산",
    "etf": "ETF",
}

_KEYWORD_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("ETF", (" etf ", " etn ", " trust ", " fund ", "spdr", "ishares", "vanguard", "invesco", "wisdomtree", "proshares", "direxion", "global x", "kodex", "tiger", "arirang", "kbstar", "ace", " sol ", "vaneck", "victoryshares", "glaciershares", "defiance", "leverage shares", "yieldmax", "roundhill", "themes", "graniteshares", "simplify", "pacer", "kraneshares", "cambria", "robo global", "bitwise")),
    ("부동산", ("부동산", "리츠", "부동산 투자", "real estate", "reit", "property", "properties", "realty")),
    ("금융", ("금융", "은행", "보험", "증권", "신탁", "집합투자", "카드", "인수목적", "스팩", "뱅크", "금융지주", "capital markets", "asset management", "banks", "banking", "bankshares", "bancorp", "commercial banks", "savings institutions", "insurance", "financial", "finance", "brokerage", "security brokers", "dealers", "credit", "investment company", "business development company", "bdc", "acquisition", "blank check", "advisors")),
    ("헬스케어", ("헬스", "의료", "제약", "의약", "바이오", "pharma", "pharmaceutical", "pharmaceutical preparations", "biotech", "biological products", "drug", "therapeutic", "diagnostic", "medical", "medical laboratories", "surgical", "healthcare", "analytical instruments", "dental equipment", "dental supplies")),
    ("정보기술", ("반도체", "소프트웨어", "전자부품", "컴퓨터", "디스플레이", "정보 서비스", "통신 및 방송 장비", "측정", "시험", "항해", "정밀기기", "광학기기", "사진장비", "자료처리", "호스팅", "포털", "인터넷 정보매개", "마그네틱", "광학 매체", "영상 및 음향기기", "semiconductor", "software", "prepackaged software", "computer programming", "computer integrated systems design", "computer peripheral", "semiconductors", "hardware", "computer", "electronic computers", "consumer electronics", "electronic", "it service", "information service", "internet platform", "data processing", "hosting", "portal", "internet", "optical", "measurement", "testing", "navigation")),
    ("커뮤니케이션서비스", ("통신업", "방송", "출판", "광고", "영화", "엔터테인먼트", "창작", "예술관련", "영상 오디오물 제공", "오디오물 제공 서비스업", "telecom", "media", "advertising", "entertainment", "publishing", "broadcasting", "interactive media", "content", "streaming")),
    ("유틸리티", ("전력", "가스", "수도", "증기", "전기업", "utility", "utilities", "regulated electric", "regulated gas", "water utility", "electric services combined", "electric other services combined")),
    ("에너지", ("에너지", "석유", "가스 채굴", "정유", "oil", "gas", "drilling", "energy")),
    ("소재", ("소재", "화학", "금속", "철강", "비금속", "광업", "플라스틱", "고무", "시멘트", "제지", "펄프", "목재", "나무제품", "비료", "농약", "살균", "살충제", "골판지", "종이 상자", "종이용기", "유리", "aluminum", "primary production", "chemicals", "materials", "steel", "metals", "mining", "paper", "forest", "plastic", "glass", "fertilizer")),
    ("필수소비재", ("식품", "음료", "담배", "사료", "유제품", "생활용품", "가정용품", "도축", "육류 가공", "곡물가공품", "전분", "과실", "채소 가공", "작물 재배", "food", "beverage", "tobacco", "household", "personal product", "packaged foods", "consumer defensive", "consumer staples", "grocery")),
    ("경기소비재", ("자동차", "섬유", "의류", "화장품", "호텔", "레저", "여행", "백화점", "소매", "교육", "가구", "봉제의복", "방적", "직물", "가죽", "가방", "가정용 기기", "교습 학원", "전문디자인", "운동 및 경기용구", "음식점업", "숙박시설", "auto", "apparel", "retail", "leisure", "travel", "lodging", "restaurant", "furnishing", "consumer cyclical", "consumer discretionary")),
    ("산업재", ("산업", "기계", "건설", "조선", "항공", "운송", "물류", "상업서비스", "전기 장비", "전동기", "발전기", "전기 변환", "공급", "제어 장치", "기타 전기장비", "전구", "조명장치", "선박", "보트", "항공기", "도매업", "상품 종합", "상품 중개", "사업지원", "그외 기타 제품", "연구개발", "엔지니어링", "경영 컨설팅", "건축기술", "건축마무리", "과학기술 서비스", "그외 기타 전문", "전기 및 통신 공사업", "케이블", "폐기물 처리", "시장조사", "전문 서비스업", "기반조성", "시설물 축조", "일차전지", "이차전지", "business services", "services to dwellings", "detective", "guard", "armored car", "commercial physical research", "air transportation", "aircraft", "industrial", "machinery", "engineering", "construction", "aerospace", "transport", "logistics", "electrical equipment", "wholesale", "consulting", "research and development")),
)


def _clean_text(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_key(value: str) -> str:
    return " ".join(value.casefold().replace("/", " ").replace("-", " ").replace("&", " ").split())


def _iter_texts(*values: object | None) -> Iterable[str]:
    for value in values:
        text = _clean_text(value)
        if text:
            yield text


def normalize_sector_label(
    raw_sector: object | None,
    raw_industry: object | None = None,
    name: object | None = None,
    asset_group: object | None = None,
) -> str | None:
    normalized_asset_group = _normalize_key(_clean_text(asset_group) or "")
    if normalized_asset_group == "etf":
        return "ETF"

    normalized_sector = _normalize_key(_clean_text(raw_sector) or "")
    if normalized_sector in _DIRECT_ALIASES:
        return _DIRECT_ALIASES[normalized_sector]

    joined_text = " ".join(_iter_texts(raw_sector, raw_industry, name))
    if not joined_text:
        return None
    padded_text = f" {_normalize_key(joined_text)} "

    for label, keywords in _KEYWORD_RULES:
        if any(keyword in padded_text for keyword in keywords):
            return label
    return None
