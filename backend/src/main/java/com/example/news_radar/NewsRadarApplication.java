package com.example.news_radar;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class NewsRadarApplication {

	public static void main(String[] args) {
		// Netty 비동기 DNS resolver 대신 JDK 기본 resolver 사용
		// Windows 환경에서 Netty DNS가 api.openai.com 해석에 간헐적으로 실패하는 문제 방지
		System.setProperty("reactor.netty.useJdkDnsResolver", "true");
		SpringApplication.run(NewsRadarApplication.class, args);
	}

}
