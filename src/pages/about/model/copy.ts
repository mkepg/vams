/**
 * Copy for the About page. The module has no imports: the lesson count is passed in, so the
 * text can be read and tested without the catalog.
 */
export interface BandCopy {
  id: string;
  title: string;
  summary: string;
}

export interface AboutFact {
  term: string;
  text: string;
  /** When set, the text renders as a link to this address. */
  href?: string;
}

const ISSUES_URL = 'https://github.com/mkepg/vams/issues';

export const ABOUT_COPY = {
  title: 'About VAMS',
  lede: 'A 2D OpenGL 1.5 teaching tool that began as an undergraduate thesis.',
  bands: {
    story: { id: 'story', title: 'Why VAMS exists', summary: 'From a thesis to a tool students use.' },
    students: { id: 'students', title: 'For students', summary: 'What it teaches, where it runs, and where your work is kept.' },
    thesis: { id: 'thesis', title: 'The thesis', summary: 'The record, and how to cite it.' },
  } satisfies Record<string, BandCopy>,
  story: (lessons: number): string[] => [
    'Computer graphics courses ask students to work with vectors, matrices and coordinate systems, and then to picture what those numbers do on screen. Most students can rotate a triangle by 45 degrees on paper. Far fewer can see that rotation before they run the program, and in an OpenGL course running it first means a compiler, a GLUT install and a build script.',
    'VAMS began as our undergraduate thesis at FEU Institute of Technology. The idea was simple: instead of asking students to connect an equation to a picture in their heads, show both at once. You build a scene by hand, and VAMS writes the OpenGL that draws it and shows the math underneath, live.',
    'It is meant as a first step, not a replacement for professional tools. Students learn the pipeline here, then carry the same code and the same math into a real OpenGL project.',
    `After the thesis, we kept building: a guided course of ${lessons} lessons, a redesigned editor, and a site that works offline. VAMS is free and open source under the MIT License.`,
  ],
  facts: (lessons: number): AboutFact[] => [
    {
      term: 'What it teaches',
      text: `OpenGL 1.5 in 2D, in five sections that follow the pipeline: Pipeline, Primitives, Buffers, Transforms, Textures. ${lessons} lessons in all.`,
    },
    { term: 'Two modes', text: 'Author, where you build freely. Lesson, where guided steps play out and exercises check your scene.' },
    { term: 'Where it runs', text: 'A desktop browser: Chrome, Edge or Firefox. Nothing to install.' },
    { term: 'Offline', text: 'After your first visit VAMS works without internet, and you can install it as an app from your browser.' },
    {
      term: 'Your work',
      text: 'Your scene and your lesson progress stay in this browser between visits. My scenes keeps named scenes and your last five backups. To move work to another computer, save a project file.',
    },
    { term: 'Found a problem?', text: 'Open an issue on GitHub', href: ISSUES_URL },
  ],
  issuesUrl: ISSUES_URL,
  authorsLabel: 'Authors',
  adviserLabel: 'Adviser',
  degreeLabel: 'Degree',
  institutionLabel: 'Institution',
  yearLabel: 'Year',
  citationLabel: 'Citation format',
  copy: 'Copy',
  copied: 'Copied',
  copyFallback: 'Press Ctrl+C to copy',
};

export const THESIS = {
  title: 'V.A.M.S: A Geometric Modeling and Animation Studio for Introductory Computer Graphics Courses',
  authors: ['Mikhael Edman P. Gomez', 'Johann Patrick S. Taguiam', 'Justine Jhigz D. Vizco'],
  adviser: 'Elisa V. Malasaga',
  degree: 'BS Computer Science, specialization in Software Engineering',
  institution: 'FEU Institute of Technology',
  year: 2026,
} as const;

export type CitationId = 'apa' | 'bibtex';

/** APA 7 in three parts, so the page can set the title in italics; the copied text is plain. */
export const APA_PARTS = {
  lead: 'Gomez, M. E. P., Taguiam, J. P. S., & Vizco, J. J. D. (2026). ',
  title: 'V.A.M.S: A geometric modeling and animation studio for introductory computer graphics courses',
  tail: ' [Undergraduate thesis, FEU Institute of Technology].',
};

export const CITATIONS: Record<CitationId, string> = {
  apa: `${APA_PARTS.lead}${APA_PARTS.title}${APA_PARTS.tail}`,
  // BibTeX has no undergraduate thesis type; @mastersthesis with a type field is the usual form.
  bibtex: [
    '@mastersthesis{gomez2026vams,',
    '  author = {Gomez, Mikhael Edman P. and Taguiam, Johann Patrick S. and Vizco, Justine Jhigz D.},',
    '  title  = {{V.A.M.S}: A Geometric Modeling and Animation Studio for Introductory Computer Graphics Courses},',
    '  school = {FEU Institute of Technology},',
    '  type   = {Undergraduate thesis},',
    '  year   = {2026}',
    '}',
  ].join('\n'),
};
