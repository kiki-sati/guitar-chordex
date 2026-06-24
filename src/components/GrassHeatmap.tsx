import { buildGrass } from '../domain/practice';
import { GLEVELS } from '../domain/constants';
import { ko } from '../i18n/strings';
import styles from './GrassHeatmap.module.css';
import type { GrassMap } from '../domain/types';

interface GrassHeatmapProps {
  grass: GrassMap;
  cellSize?: number;
  showLegend?: boolean;
}

/** 잔디 히트맵 + 범례 (원본 grassEl/legendEl 라인 533-537). */
export function GrassHeatmap({
  grass,
  cellSize = 11,
  showLegend = true,
}: GrassHeatmapProps) {
  const weeks = buildGrass(grass);
  const gap = 3;

  return (
    <div>
      <div className={styles.grid} style={{ gap }} data-testid="grass-grid">
        {weeks.map((w, wi) => (
          <div key={wi} className={styles.col} style={{ gap }}>
            {w.map((c, di) => (
              <div
                key={di}
                data-testid={c ? 'grass-cell' : 'grass-empty'}
                title={c ? c.ds + ' · ' + c.count + '회' : ''}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 2,
                  background: c ? GLEVELS[c.level] : 'transparent',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      {showLegend ? (
        <div className={styles.legend}>
          {ko.grassLess}
          {GLEVELS.map((c, i) => (
            <div
              key={i}
              className={styles.legendCell}
              style={{ background: c }}
            />
          ))}
          {ko.grassMore}
        </div>
      ) : null}
    </div>
  );
}
