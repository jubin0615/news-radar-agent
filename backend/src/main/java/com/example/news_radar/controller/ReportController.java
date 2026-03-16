package com.example.news_radar.controller;

import com.example.news_radar.dto.ReportResult;
import com.example.news_radar.service.KeywordService;
import com.example.news_radar.service.ReportService;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.List;

// 리포트 생성 API — 사용자 키워드 기반 격리
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final KeywordService keywordService;

    // JSON 리포트 조회 — 사용자 본인의 키워드인지 검증
    @GetMapping
    public ResponseEntity<ReportResult> getReport(
            @AuthenticationPrincipal Long userId,
            @RequestParam String keyword,
            @RequestParam(required = false) String date) {
        List<String> myKeywords = keywordService.getKeywordNamesByUser(userId);
        boolean isOwned = myKeywords.stream().anyMatch(k -> k.equalsIgnoreCase(keyword));
        if (!isOwned) {
            return ResponseEntity.ok(new ReportResult(0, 0, "해당 키워드에 대한 접근 권한이 없습니다.", List.of(), List.of()));
        }

        LocalDate targetDate = (date != null) ? LocalDate.parse(date) : LocalDate.now();
        return ResponseEntity.ok(reportService.generateReport(keyword, targetDate));
    }

    // 마크다운 리포트 다운로드 — 사용자 본인의 키워드인지 검증
    @GetMapping("/markdown")
    public ResponseEntity<Resource> downloadMarkdown(
            @AuthenticationPrincipal Long userId,
            @RequestParam String keyword,
            @RequestParam(required = false) String date) {
        List<String> myKeywords = keywordService.getKeywordNamesByUser(userId);
        boolean isOwned = myKeywords.stream().anyMatch(k -> k.equalsIgnoreCase(keyword));
        if (!isOwned) return ResponseEntity.status(403).build();

        LocalDate targetDate = (date != null) ? LocalDate.parse(date) : LocalDate.now();
        return reportService.generateMarkdownReport(keyword, targetDate)
                .map(filePath -> {
                    Path path = Paths.get(filePath);
                    Resource resource = new FileSystemResource(path);
                    return ResponseEntity.ok()
                            .contentType(MediaType.APPLICATION_OCTET_STREAM)
                            .header(HttpHeaders.CONTENT_DISPOSITION,
                                    "attachment; filename=\"" + path.getFileName() + "\"")
                            .<Resource>body(resource);
                })
                .orElse(ResponseEntity.internalServerError().build());
    }

    // 일일 리포트 — 사용자 키워드 기반
    @PostMapping("/daily")
    public ResponseEntity<ReportResult> generateDailyReport(@AuthenticationPrincipal Long userId) {
        List<String> myKeywords = keywordService.getKeywordNamesByUser(userId);
        if (myKeywords.isEmpty()) {
            return ResponseEntity.ok(new ReportResult(0, 0, "등록된 키워드가 없습니다.", List.of(), List.of()));
        }
        return ResponseEntity.ok(reportService.generateDailyReport(myKeywords));
    }
}
