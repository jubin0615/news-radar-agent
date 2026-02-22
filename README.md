# 📡 News Radar Agent (뉴스 레이더)

**News Radar Agent**는 사용자가 설정한 관심 키워드를 바탕으로 뉴스를 자동 수집하고, AI를 통해 정보의 가치를 평가하며, 대화형 인터페이스(RAG)로 궁금한 점을 즉시 해결할 수 있는 **지능형 뉴스 큐레이션 및 분석 플랫폼**입니다.

단순히 뉴스를 나열하는 것을 넘어 다각도의 AI 평가 지표를 제공하여 바쁜 현대인과 IT 개발자가 가장 중요한 정보만 빠르게 파악할 수 있도록 돕습니다.

## ✨ 주요 기능

* **🎯 맞춤형 뉴스 크롤링:** 사용자가 등록한 키워드(예: AI, 반도체 등)를 기반으로 최신 뉴스를 자동으로 수집합니다.
* **🧠 AI 중요도 평가:** 수집된 뉴스를 OpenAI GPT 모델이 분석하여 파급력, 혁신성, 시의성 점수를 매기고 한 줄 요약을 제공합니다.
* **💬 RAG 기반 대화형 Q&A:** 수집된 뉴스 데이터베이스(Vector Store)를 기반으로 동작하는 AI 에이전트와 대화하며, 출처가 명확하고 신뢰할 수 있는 답변을 얻을 수 있습니다.
* **📊 트렌드 및 분석 리포트:** 키워드별 뉴스 트렌드 추이를 확인하고, 종합적인 분석 리포트를 생성합니다.

## 🛠 Tech Stack

### Backend
* **Framework:** Java+Spring Boot
* **AI & Data:** Spring AI, OpenAI API (GPT-4o-mini), SimpleVectorStore (In-Memory RAG)
* **Database:** Spring Data JPA, H2 Database
* **Crawling:** Jsoup (Naver News)

### Frontend
* **Framework:** Next.js, React
* **Styling:** Tailwind CSS
* **Integration:** CopilotKit (AI Agent UI)

## 📁 프로젝트 구조

프론트엔드와 백엔드가 분리된 모노레포 형태로 구성

```text
news-radar-agent/
├── backend/          # Spring Boot 기반의 API 서버 및 AI 에이전트 (크롤링, 임베딩, RAG)
└── frontend/         # Next.js 기반의 사용자 웹 인터페이스