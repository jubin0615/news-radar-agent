# 📡 News Radar Agent - Frontend

**News Radar Agent**의 프론트엔드 애플리케이션은 사용자에게 수집된 뉴스 데이터와 AI 분석 결과를 직관적이고 시각적으로 제공하는 모던 웹 인터페이스입니다. 

단순한 데이터 나열을 넘어, **CopilotKit을 활용한 대화형 AI 에이전트**, **Framer Motion 기반의 부드러운 인터랙션**, 그리고 **SSE(Server-Sent Events)를 통한 실시간 수집 상태 모니터링**을 지원하여 사용자 경험(UX)을 극대화하는 데 초점을 맞췄습니다.

## ✨ 주요 기능 및 UI/UX 포인트

### 1. 🤖 대화형 AI 뉴스 에이전트 (CopilotKit Integration)
* **컨텍스트 인식 대화:** 사용자가 현재 보고 있는 뉴스나 키워드 문맥을 파악하여, 백엔드의 RAG 파이프라인과 연동해 정확하고 출처가 분명한 답변을 제공합니다.
* **마크다운 리포트 렌더링:** AI가 생성한 뉴스 브리핑과 분석 리포트를 `react-markdown` 및 `rehype-highlight`를 통해 가독성 높은 마크다운 및 코드 하이라이팅 형태로 렌더링합니다.

### 2. ⚡ 실시간 데이터 스트리밍 및 상태 관리
* **SSE(Server-Sent Events) 커스텀 훅:** `useCollectionSSE` 훅을 구현하여, 백엔드에서 뉴스를 크롤링하고 AI로 평가하는 일련의 진행 상태를 사용자에게 실시간 프로그레스 바 형태로 제공합니다.
* **비동기 UI 처리:** React 19의 최신 기능과 Next.js App Router를 활용해 서버 사이드 렌더링(SSR)과 클라이언트 인터랙션을 최적화했습니다.

### 3. 🎨 시각화
* **스와이프 및 캐러셀 UI:** `Framer Motion`을 활용하여 모닝 브리핑 스와이프 카드(`AiBriefingSwipeCards`), 뉴스 캐러셀(`NewsCarousel`) 등 직관적인 애니메이션을 구현했습니다.
* **키워드 맵 및 대시보드:** 관심 키워드의 트렌드와 뉴스 통계를 한눈에 파악할 수 있는 HUD(Head-Up Display) 스타일의 대시보드를 제공합니다.

## 🛠 기술 스택

### Core & Framework
* **Framework:** Next.js 16 (App Router)
* **Library:** React 19
* **Language:** TypeScript

### Styling & UI/UX
* **CSS Framework:** Tailwind CSS v4
* **Animation:** Framer Motion
* **Icons:** Lucide React
* **Components:** AG UI (`@ag-ui/client`), Tailwind Merge, clsx

### AI & Data Handling
* **AI Agent UI:** CopilotKit (`@copilotkit/react-core`, `@copilotkit/react-ui`)
* **Markdown:** React Markdown, Remark GFM, Rehype Highlight
* **State & Stream:** RxJS (이벤트 스트림 관리)

## 📁 주요 디렉토리 구조

```text
frontend/
├── src/
│   ├── app/                    # Next.js App Router 기반의 페이지 및 API 라우트
│   │   ├── api/                # BFF (Backend for Frontend) 패턴의 API 프록시 라우트
│   │   └── page.tsx            # 메인 대시보드 페이지
│   ├── components/             # 재사용 가능한 UI 컴포넌트 모음
│   │   ├── common/             # 공통 UI (통계 카드, 키워드 매니저 등)
│   │   ├── generative/         # AI 생성 컨텐츠 뷰어 (RAG 답변 카드, 리포트 뷰어 등)
│   │   └── layout/             # 페이지 레이아웃 (사이드바, 헤더, 대시보드 HUD 등)
│   ├── hooks/                  # 커스텀 React 훅 (useCollectionSSE 등)
│   ├── lib/                    # 유틸리티 함수 및 Context Providers (cn.ts 등)
│   └── types/                  # TypeScript 인터페이스 및 타입 정의
├── tailwind.config.ts          # Tailwind CSS 커스텀 설정
└── package.json                # 프로젝트 의존성 관리