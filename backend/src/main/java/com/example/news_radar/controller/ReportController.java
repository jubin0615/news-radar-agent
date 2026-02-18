package com.example.news_radar.controller;

import com.example.news_radar.dto.ReportResult;
import com.example.news_radar.service.ReportService;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;

// 리포트 생성 API
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    // JSON 리포트 조회
    @GetMapping
    public ResponseEntity<ReportResult> getReport(
            @RequestParam String keyword,
            @RequestParam(required = false) String date) {
        LocalDate targetDate = (date != null) ? LocalDate.parse(date) : LocalDate.now();
        return ResponseEntity.ok(reportService.generateReport(keyword, targetDate));
    }

    // 마크다운 리포트 다운로드
    @GetMapping("/markdown")
    public ResponseEntity<Resource> downloadMarkdown(
            @RequestParam String keyword,
            @RequestParam(required = false) String date) {
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

    // 일일 리포트 수동 생성
    @PostMapping("/daily")
    public ResponseEntity<ReportResult> generateDailyReport() {
        return ResponseEntity.ok(reportService.generateDailyReport());
    }
}
