import { useApp } from '../state/AppContext';
import { SheetCard } from '../components/builder/SheetCard';
import { ChordPalette } from '../components/builder/ChordPalette';
import { SavedSheets } from '../components/builder/SavedSheets';
import { ko } from '../i18n/strings';
import styles from './BuilderView.module.css';

/**
 * 악보 빌더 뷰 (원본 builderView 라인 604-672, PR-1 로컬 전용).
 * 상태·dispatch만 배선한다 — 코드/보이싱/기하 계산은 domain(sheet.ts) + ChordDiagram 재사용.
 * 오디오 재생은 후속(SheetCard의 재생 버튼 disabled).
 */
export function BuilderView() {
  const { state, dispatch } = useApp();

  return (
    <div className="view-pad" style={{ padding: '22px 28px 56px' }}>
      <div className={styles.stack}>
        <SheetCard
          title={state.sheetTitle}
          timeSig={state.timeSig}
          sequence={state.sequence}
          armed={state.armedChord}
          onTitleChange={(title) =>
            dispatch({ type: 'SET_SHEET_TITLE', title })
          }
          onTimeSigChange={(timeSig) =>
            dispatch({ type: 'SET_TIME_SIG', timeSig })
          }
          onBeatClick={(index) => dispatch({ type: 'PLACE_AT', index })}
          onRemoveMeasure={(measureIndex) =>
            dispatch({ type: 'REMOVE_MEASURE', measureIndex })
          }
          onAddMeasure={() => dispatch({ type: 'ADD_MEASURE' })}
          onClear={() => dispatch({ type: 'CLEAR_SEQUENCE' })}
          onSave={() => dispatch({ type: 'SAVE_SHEET' })}
        />

        <div>
          <div className={styles.paletteTitle}>{ko.builderPaletteTitle}</div>
          <ChordPalette
            collected={state.collected}
            armed={state.armedChord}
            onArm={(chord) => dispatch({ type: 'ARM_CHORD', chord })}
            onRemove={(index) =>
              dispatch({ type: 'REMOVE_COLLECTED', index })
            }
            onGoToDictionary={() =>
              dispatch({ type: 'SET_VIEW', view: 'dictionary' })
            }
          />
        </div>

        <SavedSheets
          sheets={state.sheets}
          onLoad={(id) => dispatch({ type: 'LOAD_SHEET', id })}
          onDelete={(id) => dispatch({ type: 'DELETE_SHEET', id })}
        />
      </div>
    </div>
  );
}
