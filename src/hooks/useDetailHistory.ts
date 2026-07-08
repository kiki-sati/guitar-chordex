import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import type { Dispatch } from 'react';
import type { Action } from '../state/appReducer';
import type { ChordDetail } from '../domain/types';

/**
 * 브라우저/PWA 뒤로가기로 상세 화면을 닫는 얇은 history 미러 (웹 전용).
 *
 * 규칙(계획 §2.4·§6.3):
 *  - 상세 열림(null→non-null): `history.pushState({csDetail:true})` 1개.
 *  - popstate(사용자 뒤로가기) + 상세 열림: `dispatch(CLOSE_DETAIL)`.
 *  - 프로그램적 닫힘(버튼/HW, non-null→null): 우리가 push한 엔트리를 `history.back()`으로 1회 되감기.
 *  - popstate로 닫힌 경우엔 그 엔트리가 이미 소비됐으므로 back() 하지 않음(재귀 가드).
 *
 * 네이티브(Capacitor)에서는 전체 no-op — 하드웨어 backButton 리스너(App.tsx)가 담당한다
 * (history와 HW 이중 발화 방지, §2.4-(2)).
 */
export function useDetailHistory(
  detailChord: ChordDetail | null,
  dispatch: Dispatch<Action>,
): void {
  const native = Capacitor.isNativePlatform();

  // 최신 상태/콜백을 리스너에서 참조하기 위한 refs (effect 재구독 없이).
  const openRef = useRef(!!detailChord);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // popstate가 유발한 닫힘인지 표시 — 이 경우 프로그램적 back()을 건너뛴다.
  const closingFromPopRef = useRef(false);
  // 이전 열림 여부(전환 감지).
  const prevOpenRef = useRef(!!detailChord);

  // popstate 리스너는 마운트당 1회만 등록. 최신 열림 여부는 openRef로 읽는다.
  useEffect(() => {
    if (native) return;
    const onPop = () => {
      if (openRef.current) {
        closingFromPopRef.current = true;
        dispatchRef.current({ type: 'CLOSE_DETAIL' });
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [native]);

  // 열림/닫힘 전환에 history를 미러링.
  useEffect(() => {
    const isOpen = !!detailChord;
    openRef.current = isOpen;

    if (native) {
      prevOpenRef.current = isOpen;
      return;
    }

    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (!wasOpen && isOpen) {
      // 열림 → history 엔트리 1개 push.
      window.history.pushState({ csDetail: true }, '');
    } else if (wasOpen && !isOpen) {
      // 닫힘 → popstate로 닫힌 게 아니면 우리가 push한 엔트리를 되감는다.
      if (closingFromPopRef.current) {
        closingFromPopRef.current = false;
      } else {
        const st = window.history.state as { csDetail?: boolean } | null;
        if (st?.csDetail) window.history.back();
      }
    }
  }, [detailChord, native]);
}
