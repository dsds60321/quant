- 개발자와 의사소통은 한국어로 진행한다.
- `frontend` 폴더는 화면 클라이언트 소스가 있다. 해당 프로젝트는 Next.js 프레임워크로 진행한다.

## 현재 UI 전체 구조

- 지금 플랫폼은 아래 15개 모듈로 구성되어 있다.
1. Dashboard
2. Market Overview
3. Strategy Builder
4. Backtest
5. Portfolio
6. Stock Screener
7. Research Notebook
8. Strategy Library
9. Strategy Execution Center
10. Trade Center
11. Data Center
12. Strategy Optimization
13. Strategy Compare
14. Risk Center
15. Settings

## UI별 기능 설명

### 1. Dashboard

- 목적: 플랫폼 전체 상태 확인
- 기능:
  - 포트폴리오 가치
  - 일간 수익률
  - 샤프지수
  - 알파
  - 활성 전략 수
  - 최대 낙폭
- 그래프:
  - Equity Curve
  - Portfolio Allocation
- 사용자 행동:
  - 현재 전략 상태 확인
  - 성과 확인

### 2. Market Overview

- 목적: 시장 상태 확인
- 기능:
  - S&P500
  - NASDAQ
  - KOSPI
  - KOSDAQ
- 그래프:
  - 미니 차트
  - 섹터 히트맵
- 사용자 행동:
  - 시장 분위기 확인
  - 섹터 흐름 확인

### 3. Strategy Builder

- 목적: 전략 생성
- 기능:
  - 팩터:
    - ROE
    - PER
    - PBR
    - 모멘텀
    - 시가총액
    - 거래량
  - 포트폴리오:
    - 종목 수
    - 리밸런싱
    - 가중 방식
- 사용자 행동:
  - 팩터 설정
  - 포트폴리오 설정
  - 백테스트 실행

### 4. Backtest

- 목적: 전략 검증
- 기능:
  - 지표:
    - CAGR
    - Sharpe
    - MDD
    - Win rate
    - Volatility
- 그래프:
  - Equity curve
  - Drawdown
  - Monthly return heatmap
- 사용자 행동:
  - 전략 성능 확인
- 참고: 백테스트는 과거 데이터로 전략 성과를 검증하는 핵심 단계다.

### 5. Portfolio

- 목적: 현재 투자 상태
- 기능:
  - 총 자산
  - 일간 수익률
  - 월간 수익률
  - 리스크
- 그래프:
  - 자산 배분
- 테이블:
  - 보유 종목
  - 수량
  - 손익
- 사용자 행동:
  - 포트폴리오 확인

### 6. Stock Screener

- 목적: 조건 기반 종목 탐색
- 필터:
  - PER
  - PBR
  - ROE
  - 시가총액
  - 배당
  - 거래량
- 사용자 행동:
  - 종목 후보 찾기

### 7. Research Notebook

- 목적: 퀀트 연구
- 기능:
  - Python 코드
  - 데이터 분석
  - 그래프
- 사용자 행동:
  - 전략 실험
  - 데이터 분석

### 8. Strategy Library

- 목적: 전략 저장
- 기능:
  - CAGR
  - Sharpe
  - MDD
- 버튼:
  - 실행
  - 복제
  - 삭제
- 사용자 행동:
  - 전략 재사용

### 9. Strategy Execution Center

- 목적: 전략 실행
- 기능:
  - 전략 상태
  - 실시간 수익률
  - 매수/매도 신호
- 버튼:
  - 전략 시작
  - 전략 중지
  - 리밸런싱

### 10. Trade Center

- 목적: 주문 관리
- 테이블:
  - 주문
  - 체결
  - 포지션
- 사용자 행동:
  - 주문 확인

### 11. Data Center

- 목적: 데이터 관리
- 기능:
  - 데이터 업데이트
  - 데이터 상태
  - 데이터 소스

### 12. Strategy Optimization

- 목적: 전략 파라미터 최적화
- 기능:
  - Parameter search
  - Sharpe vs parameter
  - CAGR vs parameter

### 13. Strategy Compare

- 목적: 전략 비교
- 그래프:
  - Equity overlay
- 테이블:
  - CAGR
  - Sharpe
  - MDD
  - Win rate

### 14. Risk Center

- 목적: 리스크 관리
- 지표:
  - VaR
  - Beta
  - Volatility
  - Sector exposure
- 기능:
  - 리스크 이벤트 로그
- 참고: 퀀트 트레이딩에서는 리스크 관리가 필수 구성 요소다.

### 15. Settings

- 목적: 환경 설정
- 기능:
  - 알림
  - 데이터 연결
  - 권한

## 실제 사용자가 작업하는 흐름

1. 시장 확인: Market Overview
2. 종목 탐색: Stock Screener
3. 전략 설계: Strategy Builder
4. 전략 검증: Backtest
5. 전략 저장: Strategy Library
6. 전략 실행: Strategy Execution
7. 포트폴리오 관리: Portfolio
8. 리스크 관리: Risk Center
