# 📡 News Radar Agent - Backend Server

**News Radar Agent**의 백엔드 서버는 사용자의 관심 키워드를 기반으로 뉴스를 수집하고, LLM을 활용해 정보의 가치를 평가하며, RAG 기반의 AI 대화 에이전트를 제공하는 역할을 합니다.

단순한 CRUD API 서버를 넘어, **외부 데이터(뉴스) 수집 파이프라인 구축**, **AI 모델(OpenAI) 통합**, **벡터 데이터베이스(PgVector) 기반의 시맨틱 검색** 등 복잡한 데이터 플로우를 안정적으로 처리하는 데 집중했습니다.

## ✨ 주요 기능

### 1. 🎯 자동화된 뉴스 수집 파이프라인 (Crawling & Processing)
* **Jsoup 기반 크롤링:** 네이버 뉴스 등 외부 출처로부터 실시간 뉴스 데이터를 수집합니다.
* **비동기 처리:** 뉴스 크롤링 및 AI 평가 과정에서 발생하는 병목을 줄이기 위해 비동기(Async) 이벤트 기반으로 데이터를 처리합니다.

### 2. 🧠 Spring AI 기반 LLM 연동 및 RAG 파이프라인
* **AI 데이터 평가:** 수집된 원본 뉴스를 OpenAI(GPT-4o-mini) 모델에 전달하여 '파급력, 혁신성, 시의성'을 자동 평가하고 한 줄 요약을 생성합니다.
* **Vector Store & Embedding:** 처리된 뉴스 데이터를 임베딩하여 벡터 저장소에 적재합니다. 인메모리(SimpleVectorStore) 및 프로덕션 환경을 위한 **PgVector(PostgreSQL)**를 완벽하게 지원합니다.
* **대화형 AI 에이전트:** 사용자의 질문에 대해 벡터 DB에서 가장 연관성 높은 최신 뉴스를 검색하고, 이를 프롬프트에 주입하여 환각 없는 정확한 답변을 생성합니다.

### 3. 🛡 시스템 안정성 및 장애 격리 (Resilience)
* **Spring Retry & AOP 적용:** 외부 LLM API(OpenAI) 호출 시 발생할 수 있는 일시적 네트워크 오류나 Rate Limit(Too Many Requests)에 대비하여 **지수 백오프** 기반의 재시도 로직을 구현했습니다. 이를 통해 전체 시스템의 내결함성을 크게 향상시켰습니다.

## 🛠 기술 스택

### Core & Framework
* **Language:** Java 21
* **Framework:** Spring Boot 3.5.10
* **Build Tool:** Gradle

### AI & Data
* **AI Framework:** Spring AI (1.0.0)
* **LLM:** OpenAI API (GPT-4o-mini)
* **Vector Database:** * Spring AI PgVector (PostgreSQL)
  * SimpleVectorStore (In-Memory)
* **Database:** Spring Data JPA, H2 Database (Dev), PostgreSQL (Prod)

### Utility & Libraries
* **Crawling:** Jsoup 1.17.2
* **Resilience:** Spring Retry, Spring Boot AOP
* **Config:** Spring Dotenv
* **Etc:** Lombok, WebFlux (WebClient)

## 📁 패키지 구조

```text
src/main/java/com/example/news_radar/
├── config/        # 비동기(Async), Retry, Vector Store, CORS 등 전역 설정
├── controller/    # REST API 엔드포인트 (뉴스, 키워드, 챗봇 대화 등)
├── crawler/       # Jsoup 기반 뉴스 웹 크롤러 구현체
├── dto/           # 계층 간 데이터 전송 객체 (AI 평가 지표, 응답 포맷 등)
├── entity/        # JPA 도메인 엔티티 (News, Keyword 등)
├── repository/    # Spring Data JPA 및 커스텀 리포지토리 인터페이스
├── scheduler/     # 주기적인 자동 뉴스 수집 스케줄러
└── service/       # 핵심 비즈니스 로직 
    ├── OpenAiService.java         # LLM API 통신 및 프롬프트 엔지니어링
    ├── RagService.java            # RAG 파이프라인 (Retrieve -> Generate)
    ├── NewsVectorStoreService.java # 벡터 DB 적재 및 유사도 검색
    └── ImportanceEvaluator.java   # 수집 뉴스 중요도 평가 파이프라인