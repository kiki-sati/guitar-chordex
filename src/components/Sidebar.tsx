import { useApp } from '../state/AppContext';
import { useAuth } from '../auth/AuthProvider';
import { stats } from '../domain/practice';
import { ko } from '../i18n/strings';
import styles from './Sidebar.module.css';
import type { View } from '../state/appReducer';

interface NavDef {
  key: View;
  label: string;
  icon: string;
  disabled: boolean;
}

// 원본 navDefs 라인 798-803. builder/lesson은 MVP 비활성.
const NAV_DEFS: NavDef[] = [
  { key: 'home', label: ko.navHome, icon: 'M3 9.5 12 3l9 6.5V21H3z', disabled: false },
  { key: 'dictionary', label: ko.navDictionary, icon: 'M5 4h12a2 2 0 0 1 2 2v15H7a2 2 0 0 1-2-2zM5 4v13', disabled: false },
  { key: 'scales', label: ko.navScales, icon: 'M4 7h16M4 12h16M4 17h16', disabled: false },
  { key: 'builder', label: ko.navBuilder, icon: 'M9 18a3 3 0 1 0-6 0 3 3 0 0 0 6 0zM9 18V5l11-2v11M20 14a3 3 0 1 0-6 0 3 3 0 0 0 6 0z', disabled: false },
  { key: 'practice', label: ko.navPractice, icon: 'M4 5h16v16H4zM4 9h16M9 3v4M15 3v4M8 14h2M14 14h2', disabled: false },
  { key: 'lesson', label: ko.navLesson, icon: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 2 3 3 6 3s6-1 6-3v-5', disabled: true },
];

/** 좌측 사이드바 (원본 라인 48-72). */
export function Sidebar() {
  const { state, dispatch } = useApp();
  const { status, signOut } = useAuth();
  const st = stats(state.grass);

  return (
    <aside className={`app-sidebar ${styles.sidebar}`}>
      <div className={`sb-brand ${styles.brand}`}>
        <span className="ae" style={{ fontSize: 22, lineHeight: 1 }}>
          🎸
        </span>
        <div className={`sb-brand-text ${styles.brandText}`}>{ko.brand}</div>
      </div>

      <nav className={`sb-nav ${styles.nav}`}>
        {NAV_DEFS.map((n) => {
          const active = state.view === n.key;
          const className = [
            styles.navBtn,
            active ? styles.navActive : '',
            n.disabled ? styles.navDisabled : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={n.key}
              type="button"
              className={className}
              aria-current={active ? 'page' : undefined}
              disabled={n.disabled}
              title={n.disabled ? ko.comingSoon : undefined}
              onClick={() =>
                !n.disabled && dispatch({ type: 'SET_VIEW', view: n.key })
              }
            >
              <svg
                width={17}
                height={17}
                viewBox="0 0 24 24"
                fill="none"
                stroke={active ? '#fff' : 'var(--c-faint)'}
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flex: 'none' }}
              >
                <path d={n.icon} />
              </svg>
              <span style={{ whiteSpace: 'nowrap' }}>{n.label}</span>
            </button>
          );
        })}
      </nav>

      <div className={`sb-foot ${styles.foot}`}>
        <div className={styles.weekLabel}>{ko.thisWeek}</div>
        <div className={styles.weekRow}>
          <span className={styles.weekCount}>{st.week}</span>
          <span className={styles.weekMeta}>
            {ko.timesSuffix + ' · ' + st.streak + ko.daySuffix + ' 연속'}
          </span>
        </div>
        {status === 'authenticated' && (
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={() => void signOut()}
          >
            {ko.logout}
          </button>
        )}
      </div>
    </aside>
  );
}
