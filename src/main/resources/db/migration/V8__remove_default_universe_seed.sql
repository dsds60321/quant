DELETE FROM universe_constituents
WHERE universe_id IN (
    SELECT id
    FROM universes
    WHERE code IN ('strategy_core_equities', 'etf_universe', 'benchmark_default')
);

DELETE FROM universes
WHERE code IN ('strategy_core_equities', 'etf_universe', 'benchmark_default');
