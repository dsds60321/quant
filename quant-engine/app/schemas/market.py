from app.schemas.common import CamelModel, MarketIndexDto


class MarketIndicesResponse(CamelModel):
    indices: list[MarketIndexDto]
