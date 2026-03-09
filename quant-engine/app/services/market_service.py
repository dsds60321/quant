from __future__ import annotations

from decimal import Decimal

import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from app.schemas.common import MarketCandleDto, MarketIndexDto


INDEX_MAP = {
    "^GSPC": "S&P500",
    "^IXIC": "NASDAQ",
    "^KS11": "KOSPI",
    "^KQ11": "KOSDAQ",
}

RANGE_WINDOWS = {
    "5일": 5,
    "1개월": 22,
    "3개월": 66,
    "1년": 252,
}


class MarketService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def get_indices(self) -> list[MarketIndexDto]:
        tickers = list(INDEX_MAP.keys())
        data = yf.download(tickers=tickers, period="1y", interval="1d", group_by="ticker", auto_adjust=False, progress=False)
        results: list[MarketIndexDto] = []
        for ticker, name in INDEX_MAP.items():
            if ticker not in data:
                continue
            frame = data[ticker].dropna(subset=["Open", "High", "Low", "Close"], how="any")
            if len(frame) < 2:
                continue
            close_series = frame["Close"].dropna()
            if len(close_series) < 2:
                continue

            last_close = float(close_series.iloc[-1])
            prev_close = float(close_series.iloc[-2])
            change = (last_close / prev_close - 1) * 100 if prev_close else 0.0
            all_candles = [
                MarketCandleDto(
                    date=pd.Timestamp(index).date(),
                    open=Decimal(str(round(float(row["Open"]), 6))),
                    high=Decimal(str(round(float(row["High"]), 6))),
                    low=Decimal(str(round(float(row["Low"]), 6))),
                    close=Decimal(str(round(float(row["Close"]), 6))),
                    volume=int(float(row.get("Volume", 0) or 0)),
                )
                for index, row in frame.iterrows()
            ]
            range_candles = {
                label: all_candles[-window:]
                for label, window in RANGE_WINDOWS.items()
                if len(all_candles[-window:]) > 0
            }
            range_series = {
                label: [Decimal(str(round(float(value), 6))) for value in close_series.tail(window).tolist()]
                for label, window in RANGE_WINDOWS.items()
                if len(close_series.tail(window)) > 0
            }
            series = range_series.get("5일", [Decimal(str(round(last_close, 6)))])
            candles = range_candles.get("5일", all_candles[-5:])
            results.append(
                MarketIndexDto(
                    symbol=name,
                    name=name,
                    last_price=Decimal(str(round(last_close, 6))),
                    change_percent=Decimal(str(round(change, 6))),
                    series=series,
                    range_series=range_series,
                    candles=candles,
                    range_candles=range_candles,
                )
            )
        return results
