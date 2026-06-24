import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ChordDiagram } from '../ChordDiagram';
import { buildChord } from '../../domain/chord';

describe('ChordDiagram', () => {
  it('renders an svg', () => {
    const { container } = render(
      <ChordDiagram frets={['x', 3, 2, 0, 1, 0]} width={108} />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders one dot circle per fretted string (C major = 3 dots)', () => {
    const { container } = render(
      <ChordDiagram frets={['x', 3, 2, 0, 1, 0]} width={108} />,
    );
    const dots = container.querySelectorAll('[data-testid="diagram-dot"]');
    expect(dots).toHaveLength(3);
  });

  it('renders mute (×) and open (○) markers', () => {
    const { container, getAllByText } = render(
      <ChordDiagram frets={['x', 3, 2, 0, 1, 0]} width={108} />,
    );
    // 1 mute (string 0)
    expect(getAllByText('×')).toHaveLength(1);
    // 2 open markers (strings 3,5)
    const opens = container.querySelectorAll('[data-testid="diagram-open"]');
    expect(opens).toHaveLength(2);
  });

  it('shows a thick nut line when start===1', () => {
    const { container } = render(
      <ChordDiagram frets={['x', 3, 2, 0, 1, 0]} width={108} />,
    );
    const nut = container.querySelector('[data-testid="diagram-nut"]');
    expect(nut).toBeInTheDocument();
  });

  it('shows a start-fret label when not at the nut (dots variant)', () => {
    // high voicing -> start 7, showNut false
    const { container } = render(
      <ChordDiagram frets={['x', 7, 9, 9, 9, 7]} width={108} variant="dots" />,
    );
    expect(container.querySelector('[data-testid="diagram-nut"]')).toBeNull();
    const label = container.querySelector('[data-testid="diagram-poslabel"]');
    expect(label).toBeInTheDocument();
    expect(label?.textContent).toBe('7');
  });

  it('tones variant renders note-name text inside dots', () => {
    // C major: OPENPC=[4,9,2,7,11,4]; frets ['x',3,2,0,1,0]
    // dots: s1 f3 -> (9+3)%12=0 -> C ; s2 f2 -> (2+2)%12=4 -> E ; s4 f1 -> (11+1)%12=0 -> C
    const { getAllByText } = render(
      <ChordDiagram frets={['x', 3, 2, 0, 1, 0]} width={112} variant="tones" />,
    );
    // two C tones, one E tone
    expect(getAllByText('C').length).toBe(2);
    expect(getAllByText('E').length).toBe(1);
  });

  it('works with engine-built chords', () => {
    const chord = buildChord(5, 'maj'); // F barre
    const { container } = render(
      <ChordDiagram frets={chord.frets} width={108} />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
