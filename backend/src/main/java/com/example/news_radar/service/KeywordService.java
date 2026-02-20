package com.example.news_radar.service;

import com.example.news_radar.entity.Keyword;
import com.example.news_radar.repository.KeywordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class KeywordService {

    private final KeywordRepository keywordRepository;

    public List<Keyword> getAllKeywords() {
        return keywordRepository.findAll();
    }

    public Optional<Keyword> addKeyword(String name) {
        String normalized = name.trim().toLowerCase();
        if (keywordRepository.existsByNameIgnoreCase(normalized)) {
            log.warn("키워드 등록 중복: {}", normalized);
            return Optional.empty();
        }
        Keyword keyword = new Keyword(normalized);
        return Optional.of(keywordRepository.save(keyword));
    }

    public boolean deleteKeyword(Long id) {
        if (!keywordRepository.existsById(id)) {
            return false;
        }
        keywordRepository.deleteById(id);
        log.info("키워드 삭제 완료: id={}", id);
        return true;
    }

    public Optional<Keyword> toggleKeyword(Long id) {
        return keywordRepository.findById(id).map(keyword -> {
            keyword.setEnabled(!keyword.isEnabled());
            Keyword saved = keywordRepository.save(keyword);
            log.info("키워드 토글: id={}, enabled={}", id, saved.isEnabled());
            return saved;
        });
    }
}
