/**
 * BLACK-BOX TEST SUITE — BB-ABOUT
 * The /about page: its copy, the citation tabs, and the prerendered page.
 */
import { describe, it, expect } from 'vitest';
import { ABOUT_COPY, APA_PARTS, CITATIONS, THESIS } from '@/pages/about/model/copy';
import { TEAM } from '@/pages/home/model/content';

const SECTIONS = ['Pipeline', 'Primitives', 'Buffers', 'Transforms', 'Textures'];
const BANNED = ['coming soon', 'not yet', 'future', 'deferred', 'unsupported', 'not supported', '3d', 'lighting'];

describe('BB-ABOUT-03: The story and the facts state the lesson count and the five sections', () => {
  it('puts the count into the story and the What it teaches fact, with the sections in order', () => {
    expect(ABOUT_COPY.story(45).join(' ')).toContain('a guided course of 45 lessons');
    expect(ABOUT_COPY.story(7).join(' ')).toContain('a guided course of 7 lessons');
    const teaches = ABOUT_COPY.facts(45).find((fact) => fact.term === 'What it teaches')!;
    expect(teaches.text).toContain(`${SECTIONS.join(', ')}.`);
    expect(teaches.text).toContain('45 lessons in all.');
    expect(ABOUT_COPY.facts(45).map((fact) => fact.term)).toEqual([
      'What it teaches',
      'Two modes',
      'Where it runs',
      'Offline',
      'Your work',
      'Found a problem?',
    ]);
    expect(ABOUT_COPY.story(45)).toHaveLength(4);
  });
});

describe('BB-ABOUT-04: The thesis credits match the home page team', () => {
  it('lists the three authors and the adviser named on the Team slide', () => {
    const members = TEAM.members.filter((m) => m.role === 'member').map((m) => m.name);
    const adviser = TEAM.members.find((m) => m.role === 'adviser')!.name;
    expect([...THESIS.authors].sort()).toEqual([...members].sort());
    expect(THESIS.adviser).toBe(adviser);
    expect(THESIS.authors).toEqual(['Mikhael Edman P. Gomez', 'Johann Patrick S. Taguiam', 'Justine Jhigz D. Vizco']);
    expect(THESIS.year).toBe(2026);
    expect(THESIS.institution).toBe('FEU Institute of Technology');
  });
});

describe('BB-ABOUT-05: The citations are exact', () => {
  it('formats APA 7 and BibTeX as the spec gives them', () => {
    expect(CITATIONS.apa).toBe(
      'Gomez, M. E. P., Taguiam, J. P. S., & Vizco, J. J. D. (2026). V.A.M.S: A geometric modeling and animation studio for introductory computer graphics courses [Undergraduate thesis, FEU Institute of Technology].',
    );
    expect(`${APA_PARTS.lead}${APA_PARTS.title}${APA_PARTS.tail}`).toBe(CITATIONS.apa);
    expect(APA_PARTS.title).toBe('V.A.M.S: A geometric modeling and animation studio for introductory computer graphics courses');
    expect(CITATIONS.bibtex).toBe(
      [
        '@mastersthesis{gomez2026vams,',
        '  author = {Gomez, Mikhael Edman P. and Taguiam, Johann Patrick S. and Vizco, Justine Jhigz D.},',
        '  title  = {{V.A.M.S}: A Geometric Modeling and Animation Studio for Introductory Computer Graphics Courses},',
        '  school = {FEU Institute of Technology},',
        '  type   = {Undergraduate thesis},',
        '  year   = {2026}',
        '}',
      ].join('\n'),
    );
  });
});

describe('BB-ABOUT-09: Students report problems on GitHub Issues', () => {
  it('links the last fact to the repository issues page', () => {
    const report = ABOUT_COPY.facts(45).at(-1)!;
    expect(report).toEqual({ term: 'Found a problem?', text: 'Open an issue on GitHub', href: 'https://github.com/mkepg/vams/issues' });
    expect(ABOUT_COPY.issuesUrl).toBe('https://github.com/mkepg/vams/issues');
  });
});

describe('BB-ABOUT-10: The About copy follows the student-facing language rules', () => {
  it('contains none of the banned phrases', () => {
    const text = JSON.stringify([ABOUT_COPY, ABOUT_COPY.story(45), ABOUT_COPY.facts(45), THESIS, CITATIONS]).toLowerCase();
    for (const phrase of BANNED) expect(text, phrase).not.toContain(phrase);
  });
});
