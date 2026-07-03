import { useEffect, useRef, useState } from 'react';
import type { SupabaseRepository } from './supabase-repository';
import type { AsyncRepository } from './repository';
import { MigrationModal } from '../components/MigrationModal';
import {
  hasLegacyData,
  legacyToChanges,
  loadLegacy,
} from '../sync/migration';

export interface MigrationControllerProps {
  /** profiles.migrated_at 접근용(§9.3). */
  remote: SupabaseRepository;
  /** legacy 데이터를 계정으로 apply할 SyncRepo. */
  repo: AsyncRepository;
}

type Phase = 'checking' | 'hidden' | 'prompt' | 'importing';

/**
 * 마이그레이션 판정→모달 오케스트레이션 (계획 17 §9.2).
 *
 * RepoBoundary가 authenticated에서만 마운트한다(§7.1) → local-mode/미인증은
 * 절대 안 뜸(AC⑤-6). supabase 접근은 remote(SupabaseRepository) 단일 경유.
 *
 * 판정(mount):
 *   1. getMigratedAt() 조회.
 *   2. migratedAt !== null → 아무것도 안 함(재제안 방지, AC⑤-6).
 *   3. !hasLegacyData() → setMigratedAt(now)로 재판정 스킵 → 종료(신규 유저).
 *   4. else → 모달 표시.
 *      - "가져오기": apply(legacyToChanges(loadLegacy())) → setMigratedAt(now). legacy 보존.
 *      - "새로 시작": setMigratedAt(now)만. legacy 보존.
 */
export function MigrationController({ remote, repo }: MigrationControllerProps) {
  const [phase, setPhase] = useState<Phase>('checking');
  // StrictMode 이중 마운트 방어: 판정 1회만.
  const decidedRef = useRef(false);

  useEffect(() => {
    if (decidedRef.current) return;
    decidedRef.current = true;

    let active = true;
    void (async () => {
      try {
        const migratedAt = await remote.getMigratedAt();
        if (!active) return;
        if (migratedAt !== null) {
          setPhase('hidden');
          return;
        }
        if (!hasLegacyData()) {
          // 신규 유저: 재판정 스킵 플래그만 세운다.
          await remote.setMigratedAt(new Date().toISOString());
          if (active) setPhase('hidden');
          return;
        }
        if (active) setPhase('prompt');
      } catch {
        // 조회 실패 시 조용히 숨김(오프라인 우선 — 다음 세션 재판정).
        if (active) setPhase('hidden');
      }
    })();

    return () => {
      active = false;
    };
  }, [remote]);

  const finish = async (importLegacy: boolean) => {
    setPhase('importing');
    try {
      if (importLegacy) {
        await repo.apply(legacyToChanges(loadLegacy()));
      }
      await remote.setMigratedAt(new Date().toISOString());
    } catch {
      /* 실패해도 모달은 닫는다(재제안은 다음 세션에서 migratedAt 미set이면 재판정). */
    }
    setPhase('hidden');
  };

  if (phase !== 'prompt' && phase !== 'importing') return null;

  return (
    <MigrationModal
      onImport={() => void finish(true)}
      onSkip={() => void finish(false)}
      busy={phase === 'importing'}
    />
  );
}
