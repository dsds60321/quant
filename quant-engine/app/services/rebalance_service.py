from __future__ import annotations

import pandas as pd


class RebalanceService:
    def generate_schedule(self, trading_dates: pd.DatetimeIndex, period: str) -> list[tuple[pd.Timestamp, pd.Timestamp]]:
        if trading_dates.empty:
            return []
        frame = pd.DataFrame(index=trading_dates)
        freq = {"monthly": "ME", "quarterly": "QE", "yearly": "YE"}.get(period.lower(), "ME")
        signal_dates = frame.resample(freq).last().index.intersection(trading_dates)
        schedule: list[tuple[pd.Timestamp, pd.Timestamp]] = []
        for signal_date in signal_dates:
            loc = trading_dates.get_indexer([signal_date], method="nearest")[0]
            signal = trading_dates[loc]
            execution_loc = min(loc + 1, len(trading_dates) - 1)
            execution = trading_dates[execution_loc]
            if schedule and schedule[-1][0] == signal:
                continue
            schedule.append((signal, execution))
        if not schedule:
            schedule.append((trading_dates[0], trading_dates[min(1, len(trading_dates) - 1)]))
        elif trading_dates[0] < schedule[0][1]:
            schedule.insert(0, (trading_dates[0], trading_dates[min(1, len(trading_dates) - 1)]))
        return schedule
