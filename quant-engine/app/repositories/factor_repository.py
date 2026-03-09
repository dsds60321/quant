from __future__ import annotations

from datetime import date
from decimal import Decimal

import pandas as pd
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import FactorData


class FactorRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    def replace_for_date(self, as_of_date: date, factor_frame: pd.DataFrame) -> int:
        self.session.execute(delete(FactorData).where(FactorData.date == as_of_date))
        count = 0
        for record in factor_frame.to_dict(orient="records"):
            row = FactorData(
                symbol=record["symbol"],
                date=as_of_date,
                momentum=Decimal(str(record.get("momentum"))) if pd.notna(record.get("momentum")) else None,
                volatility=Decimal(str(record.get("volatility"))) if pd.notna(record.get("volatility")) else None,
                value_score=Decimal(str(record.get("value_score"))) if pd.notna(record.get("value_score")) else None,
                quality_score=Decimal(str(record.get("quality_score"))) if pd.notna(record.get("quality_score")) else None,
                growth_score=Decimal(str(record.get("growth_score"))) if pd.notna(record.get("growth_score")) else None,
            )
            self.session.add(row)
            count += 1
        return count

    def get_for_date(self, as_of_date: date) -> pd.DataFrame:
        rows = self.session.scalars(select(FactorData).where(FactorData.date == as_of_date)).all()
        return pd.DataFrame(
            [
                {
                    "symbol": row.symbol,
                    "date": row.date,
                    "momentum": float(row.momentum) if row.momentum is not None else None,
                    "volatility": float(row.volatility) if row.volatility is not None else None,
                    "value_score": float(row.value_score) if row.value_score is not None else None,
                    "quality_score": float(row.quality_score) if row.quality_score is not None else None,
                    "growth_score": float(row.growth_score) if row.growth_score is not None else None,
                }
                for row in rows
            ]
        )
