/**
 * Copy and structured data for the home page. This module has no imports, because the SEO head
 * builder, which the Vite config loads, reads TEAM from it through a relative import.
 */
export interface HomeSection {
  id: string;
  /** Short name used in the section eyebrow and announced by the stage indicator. */
  label: string;
}

export const SECTIONS: readonly HomeSection[] = [
  { id: 'top', label: 'VAMS' },
  { id: 'problem', label: 'The problem' },
  { id: 'views', label: 'Three views' },
  { id: 'curriculum', label: 'Curriculum' },
  { id: 'under-the-hood', label: 'Under the hood' },
  { id: 'team', label: 'Team' },
  { id: 'try', label: 'Try it' },
];

export const PROBLEM = {
  title: "OpenGL is taught as code you can't see.",
  points: [
    {
      term: 'Setup before shapes.',
      text: 'A compiler, a GLUT install and a build script stand between a student and their first triangle.',
    },
    {
      term: 'Cause and effect, delayed.',
      text: 'Every change means edit, compile, run, then work out which line did what.',
    },
    {
      term: 'The math stays hidden.',
      text: 'Coordinates, colour values and matrices are applied out of sight.',
    },
  ],
};

export const VIEWS = {
  title: 'One scene, three views.',
  subhead: 'Drag a vertex. The code and the math follow.',
  caption: "This is VAMS's own code generator, running on this page.",
};

export const CURRICULUM = {
  title: 'Five sections, one pipeline.',
  modes: [
    { name: 'Author', text: 'Build freely. The code follows every change.' },
    { name: 'Lesson', text: 'Guided steps and exercises that check your scene.' },
  ],
  more: { href: '/learn', label: 'See every lesson' },
};

export const UNDER_THE_HOOD = {
  title: 'Built like the thing it teaches.',
  blocks: [
    {
      term: 'One-way data flow',
      text: 'Every action updates one store, and the canvas, code and math recompute from it. Views only read.',
    },
    {
      term: 'Code is a pure function of the scene',
      text: 'The same scene always produces byte-identical C++.',
    },
    {
      term: 'Verified',
      text: 'More than 270 automated tests, with the matrix math checked against an independent reference implementation.',
    },
  ],
  stack: ['Preact', 'TypeScript', 'Zustand + Immer', 'PixiJS 8', 'Vitest'],
};

export interface TeamMember {
  name: string;
  credit: string;
  role: 'member' | 'adviser';
}

export const TEAM: { name: string; program: string; members: readonly TeamMember[] } = {
  name: 'Panic@TheCisco',
  program: 'BS Computer Science, Software Engineering. FEU Institute of Technology',
  members: [
    { name: 'Mikhael Edman P. Gomez', credit: 'Primary Developer & Designer, Research & Documentation', role: 'member' },
    { name: 'Justine Jhigz D. Vizco', credit: 'Thesis Leader, Research, Documentation & QA', role: 'member' },
    { name: 'Johann Patrick S. Taguiam', credit: 'Research, Documentation & QA', role: 'member' },
    { name: 'Elisa V. Malasaga', credit: 'Thesis Adviser', role: 'adviser' },
  ],
};

export const TRY_IT = {
  title: 'Try it.',
  cta: 'Open the app',
  note: 'Runs in your desktop browser. Nothing to install.',
  startFrom: 'Start from:',
  /** Must match DEFAULT_SITE_URL in src/app/routes/route-meta.ts (checked by BB-HOME-12). */
  displayUrl: 'panic-vams.netlify.app',
};
