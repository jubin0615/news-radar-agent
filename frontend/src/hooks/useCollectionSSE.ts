"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface CollectionProgressEvent {
  type:
    | "STARTED"
    | "KEYWORD_BEGIN"
    | "CRAWL_DONE"
    | "FILTER_DONE"
    | "AI_EVAL_BEGIN"
    | "SAVE_DONE"
    | "KEYWORD_COMPLETE"
    | "COMPLETED"
    | "ERROR";
  keyword: string | null;
  message: string;
  currentStep: number;
  totalSteps: number;
  percentage: number;
  count: number | null;
}

interface UseCollectionSSEReturn {
  isStreaming: boolean;
  events: CollectionProgressEvent[];
  latestEvent: CollectionProgressEvent | null;
  percentage: number;
  startStream: () => void;
  stopStream: () => void;
}

export function useCollectionSSE(): UseCollectionSSEReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [events, setEvents] = useState<CollectionProgressEvent[]>([]);
  const [latestEvent, setLatestEvent] =
    useState<CollectionProgressEvent | null>(null);
  const [percentage, setPercentage] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const handleEvent = useCallback(
    (event: MessageEvent) => {
      try {
        const data: CollectionProgressEvent = JSON.parse(event.data);
        setLatestEvent(data);
        setEvents((prev) => [...prev, data]);
        if (data.percentage >= 0) {
          setPercentage(data.percentage);
        }

        // 종료 이벤트 시 스트림 자동 닫기
        if (data.type === "COMPLETED" || data.type === "ERROR") {
          stopStream();
        }
      } catch (e) {
        console.warn("[SSE] Failed to parse event:", e);
      }
    },
    [stopStream],
  );

  const startStream = useCallback(() => {
    // 상태 초기화
    setEvents([]);
    setLatestEvent(null);
    setPercentage(0);
    setIsStreaming(true);

    const es = new EventSource("/api/news/collect/stream");
    eventSourceRef.current = es;

    // 네임드 이벤트 리스너 등록
    const eventTypes = [
      "STARTED",
      "KEYWORD_BEGIN",
      "CRAWL_DONE",
      "FILTER_DONE",
      "AI_EVAL_BEGIN",
      "SAVE_DONE",
      "KEYWORD_COMPLETE",
      "COMPLETED",
      "ERROR",
    ];
    for (const type of eventTypes) {
      es.addEventListener(type, handleEvent);
    }

    // 제네릭 메시지 폴백
    es.onmessage = (event) => handleEvent(event);

    es.onerror = () => {
      console.warn("[SSE] Connection error or closed by server");
      stopStream();
    };
  }, [handleEvent, stopStream]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    isStreaming,
    events,
    latestEvent,
    percentage,
    startStream,
    stopStream,
  };
}
