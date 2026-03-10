# ---- Build Stage ----
FROM eclipse-temurin:21-jdk AS builder

WORKDIR /app

# Gradle wrapper & 설정 파일만 먼저 복사 → 의존성 캐싱
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle

# 의존성 다운로드 (소스 변경 시에도 캐시 활용)
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon

# 소스 복사 후 빌드
COPY src ./src
RUN ./gradlew bootJar --no-daemon -x test

# ---- Run Stage ----
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /app/build/libs/news-radar-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8081

ENTRYPOINT ["java", "-jar", "app.jar", "--spring.profiles.active=pgvector"]
