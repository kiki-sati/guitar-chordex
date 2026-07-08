import { useApp } from '../state/AppContext';
import { Segmented } from '../components/Segmented';
import { RootPills } from '../components/RootPills';
import { ChordCard } from '../components/ChordCard';
import { buildChord } from '../domain/chord';
import { buildSlashChord } from '../domain/slash';
import { diatonic } from '../domain/diatonic';
import { searchChords } from '../domain/searchChords';
import { noteName } from '../domain/notes';
import { NOTE, QGROUPS } from '../domain/constants';
import { ko } from '../i18n/strings';
import styles from './DictionaryView.module.css';
import type { Chord } from '../domain/types';

/** 코드 사전 (원본 chordGrid 라인 559-578). */
export function DictionaryView() {
  const { state, dispatch } = useApp();

  const onOpenDetail = (chord: Chord) =>
    dispatch({ type: 'OPEN_DETAIL', chord });
  const onCollect = (chord: Chord) =>
    dispatch({
      type: 'COLLECT',
      chord: { name: chord.name, frets: chord.frets, key: chord.name },
    });

  let body: React.ReactNode;
  const query = state.query.trim();
  if (query) {
    // 검색 로직은 도메인(searchChords)으로 위임 — 별칭/텐션/괄호/이명동음 흡수.
    // 슬래시 히트(bass 있음)는 buildSlashChord로 베이스 제약 보이싱을, 그 외는 buildChord.
    const out: Chord[] = searchChords(query).map((hit) =>
      hit.bass != null
        ? buildSlashChord(hit.root, hit.qualKey, hit.bass)
        : buildChord(hit.root, hit.qualKey),
    );
    body = out.length ? (
      <div>
        <div className={styles.resultMeta}>{ko.searchResult(out.length)}</div>
        <div className={styles.grid}>
          {out.map((c) => (
            <ChordCard
              key={c.key}
              chord={c}
              onOpenDetail={onOpenDetail}
              onCollect={onCollect}
            />
          ))}
        </div>
      </div>
    ) : (
      <div className={styles.empty}>{ko.searchEmpty(query)}</div>
    );
  } else if (state.dictMode === 'key') {
    const chords = diatonic(state.selectedRoot, state.keyType);
    const kn =
      noteName(state.selectedRoot) +
      ' ' +
      (state.keyType === 'major' ? 'Major' : 'Minor');
    body = (
      <div>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>{kn + ' ' + ko.diatonicTitle}</span>
          <span className={styles.sectionSub}>{ko.diatonicSub}</span>
        </div>
        <div className={styles.grid}>
          {chords.map((c) => (
            <ChordCard
              key={c.key}
              chord={c}
              onOpenDetail={onOpenDetail}
              onCollect={onCollect}
            />
          ))}
        </div>
      </div>
    );
  } else {
    const rn = noteName(state.selectedRoot);
    body = (
      <div>
        {QGROUPS.map((g) => (
          <div key={g.id} className={styles.group}>
            <div className={styles.sectionHead}>
              <span className={styles.groupLabel}>{g.label}</span>
              <span className={styles.sectionSub}>{rn + ' ' + ko.rootSuffix}</span>
            </div>
            <div className={styles.grid}>
              {g.quals.map((q) => {
                const c = buildChord(state.selectedRoot, q);
                return (
                  <ChordCard
                    key={c.key}
                    chord={c}
                    onOpenDetail={onOpenDetail}
                    onCollect={onCollect}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="view-pad" style={{ padding: '22px 28px 56px' }}>
      <div className={styles.toolbar}>
        <Segmented
          options={[
            { value: 'key', label: ko.byKey },
            { value: 'root', label: ko.byRoot },
          ]}
          value={state.dictMode}
          onChange={(v) => dispatch({ type: 'SET_DICT_MODE', mode: v })}
        />
        {state.dictMode === 'key' ? (
          <Segmented
            options={[
              { value: 'major', label: 'Major' },
              { value: 'minor', label: 'Minor' },
            ]}
            value={state.keyType}
            onChange={(v) => dispatch({ type: 'SET_KEY_TYPE', keyType: v })}
          />
        ) : null}
        <div className={styles.search}>
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#000"
            strokeWidth={2}
            className={styles.searchIcon}
          >
            <circle cx={11} cy={11} r={7} />
            <path d="m20 20-3-3" />
          </svg>
          <input
            className={styles.searchInput}
            value={state.query}
            onChange={(e) =>
              dispatch({ type: 'SET_QUERY', query: e.target.value })
            }
            placeholder={ko.searchPlaceholder}
            aria-label={ko.searchPlaceholder}
          />
        </div>
      </div>
      <div className={styles.roots}>
        <RootPills
          notes={NOTE}
          selected={state.selectedRoot}
          onSelect={(i) => dispatch({ type: 'SET_ROOT', root: i })}
        />
      </div>
      {body}
    </div>
  );
}
