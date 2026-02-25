package com.example.news_radar.service;

import com.example.news_radar.dto.CollectionProgressEvent;

/**
 * 뉴스 수집 진행률 옵저버 인터페이스.
 * SSE, 로깅 등 다양한 방식으로 진행 이벤트를 전달할 수 있다.
 */
public interface CollectionProgressListener {
    void onProgress(CollectionProgressEvent event);
}
