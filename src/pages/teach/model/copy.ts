export const TEACH_COPY = {
  title: 'Teaching with VAMS',
  lede: 'VAMS runs in the browser with nothing to install, so a whole lab can open the same lesson or scene from one link. This page is for instructors planning a class around it.',
  course: {
    heading: 'How the course lines up',
    intro: 'Five sections follow the OpenGL pipeline. Each has demos that walk through an idea and exercises that ask students to build it, ending in a capstone where they write the calls themselves.',
    demos: (n: number) => `${n} ${n === 1 ? 'demo' : 'demos'}`,
    exercises: (n: number) => `${n} ${n === 1 ? 'exercise' : 'exercises'}`,
    teaches: 'Teaches',
    open: 'See the lessons',
  },
  links: {
    heading: 'Hand out a link',
    intro: 'Every lesson and prepared scene has its own address. A link opens the editor straight into it, so a class can start from the same place.',
    items: [
      {
        term: 'A lesson',
        text: 'Each lesson on the Learn page links to it. The address names the lesson:',
        example: '/app?lesson=primitives-demo-2',
      },
      {
        term: 'A prepared scene',
        text: 'The gallery scenes and the sample scenes open the same way. The address names the scene:',
        example: '/app?scene=solar-system',
      },
      {
        term: 'A scene you built',
        text: 'Share in the editor’s top bar gives a link and a QR code for the scene on screen. A stored link is kept for 90 days. On a phone, it opens the scene to look at; a window at least 960 pixels wide opens the editor.',
        example: null,
      },
    ],
    scenesLabel: 'Prepared scenes',
  },
  lab: {
    heading: 'In the lab',
    items: [
      'Open the home page and the editor once on each machine while it is online. After that, VAMS works offline, so the class does not depend on the network.',
      'My scenes, backups and lesson progress are kept in that browser on that computer. On shared machines, students keep their work by saving a project file from the File menu, and open it again the same way.',
      'Export C++ code in the File menu gives the whole GLUT program the editor shows. It builds with g++ and FreeGLUT, so students can compile and run what they made.',
      'The editor is laid out for a window at least 960 pixels wide. On a projector, browser zoom sets how large it looks.',
    ],
  },
  plan: {
    heading: 'A one-hour session',
    intro: 'One way to run a lab around a single section.',
    steps: [
      { time: '5 min', text: 'Open a gallery scene on the projector, press Run, and read the code that draws it together.' },
      { time: '15 min', text: 'Step through the section’s first demo as a class. Predictions ask students to commit to an answer before the editor shows it.' },
      { time: '30 min', text: 'Students work through an exercise on their own. Goals tick off as they build; Stuck? offers hints and, if needed, Skip.' },
      { time: '10 min', text: 'Export the C++ for one student’s scene, compile it, and compare the window with the editor’s.' },
    ],
  },
  more: {
    heading: 'Read more',
    items: [
      { href: '/learn', label: 'Learn', text: 'the whole course map, with a link to every lesson' },
      { href: '/gallery', label: 'Gallery', text: 'finished scenes to open and run' },
      { href: '/guide', label: 'Guide', text: 'how the editor works, and a glossary of OpenGL terms' },
      { href: '/about', label: 'About', text: 'the thesis behind VAMS, with a citation' },
    ],
  },
} as const;
