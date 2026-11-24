// GLUT misuse, case by case: reads a case's name from standard input and runs it, so FreeGLUT's
// message, return value and exit code can be recorded on a lab PC and compared with the Lab's.
// A case that returns prints "after" (and what the call gave back), then main returns 0.
//
//   noinit-<function>    the function before glutInit
//   nowindow-<function>  the function after glutInit, with no window
//   the rest             warnings, a second glutInit, glutMainLoop's checks and how it ends
#include <GL/freeglut.h>
#include <cstdio>
#include <cstring>

static void display() { glClear(GL_COLOR_BUFFER_BIT); glutSwapBuffers(); }
static void reshape(int, int) {}
static void key(unsigned char, int, int) {}
static void special(int, int, int) {}
static void mouse(int, int, int, int) {}
static void motion(int, int) {}
static void wheel(int, int, int, int) {}
static void idle() {}
static void closed() { printf("close callback\n"); }
static void menu(int) {}
static void leave(int) { printf("timer\n"); glutLeaveMainLoop(); }

static const unsigned char text[] = "VAMS";
static void* const badFont = (void*)0x1234;

struct Case {
    const char* name;
    void (*run)();
};

// Each GLUT function of the Lab's 2D set, called once, with a line saying what it gave back.
#define CALLS(prefix) \
    { prefix "glutInitWindowPosition", [] { glutInitWindowPosition(10, 20); } }, \
    { prefix "glutInitWindowSize", [] { glutInitWindowSize(200, 100); } }, \
    { prefix "glutInitDisplayMode", [] { glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB); } }, \
    { prefix "glutCreateWindow", [] { printf("window %d\n", glutCreateWindow("Misuse")); } }, \
    { prefix "glutDestroyWindow", [] { glutDestroyWindow(1); } }, \
    { prefix "glutGetWindow", [] { printf("window %d\n", glutGetWindow()); } }, \
    { prefix "glutSetWindowTitle", [] { glutSetWindowTitle("Title"); } }, \
    { prefix "glutReshapeWindow", [] { glutReshapeWindow(120, 80); } }, \
    { prefix "glutPositionWindow", [] { glutPositionWindow(5, 5); } }, \
    { prefix "glutFullScreen", [] { glutFullScreen(); } }, \
    { prefix "glutPostRedisplay", [] { glutPostRedisplay(); } }, \
    { prefix "glutSwapBuffers", [] { glutSwapBuffers(); } }, \
    { prefix "glutMainLoop", [] { glutMainLoop(); } }, \
    { prefix "glutLeaveMainLoop", [] { glutLeaveMainLoop(); } }, \
    { prefix "glutSetOption", [] { glutSetOption(GLUT_ACTION_ON_WINDOW_CLOSE, GLUT_ACTION_GLUTMAINLOOP_RETURNS); } }, \
    { prefix "glutDisplayFunc", [] { glutDisplayFunc(display); } }, \
    { prefix "glutReshapeFunc", [] { glutReshapeFunc(reshape); } }, \
    { prefix "glutKeyboardFunc", [] { glutKeyboardFunc(key); } }, \
    { prefix "glutKeyboardUpFunc", [] { glutKeyboardUpFunc(key); } }, \
    { prefix "glutSpecialFunc", [] { glutSpecialFunc(special); } }, \
    { prefix "glutSpecialUpFunc", [] { glutSpecialUpFunc(special); } }, \
    { prefix "glutMouseFunc", [] { glutMouseFunc(mouse); } }, \
    { prefix "glutMotionFunc", [] { glutMotionFunc(motion); } }, \
    { prefix "glutPassiveMotionFunc", [] { glutPassiveMotionFunc(motion); } }, \
    { prefix "glutMouseWheelFunc", [] { glutMouseWheelFunc(wheel); } }, \
    { prefix "glutCloseFunc", [] { glutCloseFunc(closed); } }, \
    { prefix "glutIdleFunc", [] { glutIdleFunc(idle); } }, \
    { prefix "glutTimerFunc", [] { glutTimerFunc(10, leave, 1); } }, \
    { prefix "glutCreateMenu", [] { printf("menu %d\n", glutCreateMenu(menu)); } }, \
    { prefix "glutDestroyMenu", [] { glutDestroyMenu(1); } }, \
    { prefix "glutAddMenuEntry", [] { glutAddMenuEntry("Entry", 1); } }, \
    { prefix "glutAddSubMenu", [] { glutAddSubMenu("Sub", 1); } }, \
    { prefix "glutAttachMenu", [] { glutAttachMenu(GLUT_RIGHT_BUTTON); } }, \
    { prefix "glutDetachMenu", [] { glutDetachMenu(GLUT_RIGHT_BUTTON); } }, \
    { prefix "glutGet", [] { printf("get %d\n", glutGet(GLUT_WINDOW_WIDTH)); } }, \
    { prefix "glutGet-elapsed", [] { printf("elapsed %s\n", glutGet(GLUT_ELAPSED_TIME) >= 0 ? "counted" : "negative"); } }, \
    { prefix "glutGet-screen", [] { printf("screen %s\n", glutGet(GLUT_SCREEN_WIDTH) > 0 ? "known" : "unknown"); } }, \
    { prefix "glutGet-init", [] { printf("init %d %d %d %d\n", glutGet(GLUT_INIT_WINDOW_X), glutGet(GLUT_INIT_WINDOW_Y), glutGet(GLUT_INIT_WINDOW_WIDTH), glutGet(GLUT_INIT_WINDOW_HEIGHT)); } }, \
    { prefix "glutGetModifiers", [] { printf("modifiers %d\n", glutGetModifiers()); } }, \
    { prefix "glutBitmapCharacter", [] { glutBitmapCharacter(GLUT_BITMAP_9_BY_15, 'V'); } }, \
    { prefix "glutBitmapString", [] { glutBitmapString(GLUT_BITMAP_9_BY_15, text); } }, \
    { prefix "glutBitmapWidth", [] { printf("width %d\n", glutBitmapWidth(GLUT_BITMAP_9_BY_15, 'V')); } }, \
    { prefix "glutBitmapLength", [] { printf("length %d\n", glutBitmapLength(GLUT_BITMAP_9_BY_15, text)); } }, \
    { prefix "glutBitmapHeight", [] { printf("height %d\n", glutBitmapHeight(GLUT_BITMAP_9_BY_15)); } },

static void window() {
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(200, 100);
    glutCreateWindow("Misuse");
}

static const Case noInit[] = { CALLS("noinit-") };
static const Case noWindow[] = { CALLS("nowindow-") };

// Cases with glutInit called and a window open.
static const Case withWindow[] = {
    { "init-twice", [] { glutInit(nullptr, nullptr); } },
    { "get-unknown", [] { printf("get %d\n", glutGet(0x7777)); } },
    { "bitmap-character-bad-font", [] { glutBitmapCharacter(badFont, 'V'); } },
    { "bitmap-string-bad-font", [] { glutBitmapString(badFont, text); } },
    { "bitmap-width-bad-font", [] { printf("width %d\n", glutBitmapWidth(badFont, 'V')); } },
    { "bitmap-length-bad-font", [] { printf("length %d\n", glutBitmapLength(badFont, text)); } },
    { "bitmap-height-bad-font", [] { printf("height %d\n", glutBitmapHeight(badFont)); } },
    { "display-null", [] { glutDisplayFunc(nullptr); } },
    { "mainloop-no-display", [] { glutMainLoop(); } },
    { "window-get", [] { printf("get %d %d %d %d\n", glutGet(GLUT_WINDOW_WIDTH), glutGet(GLUT_WINDOW_HEIGHT), glutGetWindow(), glutGet(GLUT_INIT_WINDOW_WIDTH)); } },
    { "menu-without-current", [] { glutAddMenuEntry("Entry", 1); glutAttachMenu(GLUT_RIGHT_BUTTON); } },
    { "menu-destroy-unknown", [] { glutDestroyMenu(9); } },
    { "menu-null-callback", [] { printf("menu %d\n", glutCreateMenu(nullptr)); } },
    { "menu-submenu-unknown", [] { glutCreateMenu(menu); glutAddSubMenu("Sub", 9); } },
    { "leave-exit", [] { glutDisplayFunc(display); glutCloseFunc(closed); glutTimerFunc(10, leave, 1); glutMainLoop(); printf("after the loop\n"); } },
    { "leave-returns", [] {
        glutSetOption(GLUT_ACTION_ON_WINDOW_CLOSE, GLUT_ACTION_GLUTMAINLOOP_RETURNS);
        glutDisplayFunc(display); glutCloseFunc(closed); glutTimerFunc(10, leave, 1); glutMainLoop();
        printf("after the loop, window %d\n", glutGetWindow()); } },
    { "leave-continues", [] {
        glutSetOption(GLUT_ACTION_ON_WINDOW_CLOSE, GLUT_ACTION_CONTINUE_EXECUTION);
        glutDisplayFunc(display); glutCloseFunc(closed); glutTimerFunc(10, leave, 1); glutMainLoop();
        printf("after the loop, window %d\n", glutGetWindow()); } },
    // Not recorded: glutDestroyWindow inside the loop. FreeGLUT sometimes ends cleanly with exit 0, and
    // sometimes stops on "No display callback" first, depending on when Windows paints.
    { "destroy-then-loop", [] { glutDisplayFunc(display); glutCloseFunc(closed); glutDestroyWindow(glutGetWindow()); printf("destroyed\n"); glutMainLoop(); printf("after the loop\n"); } },
    { "size-refused-window", [] { glutInitWindowSize(-5, 0); glutInitWindowSize(0, 50); glutDisplayFunc(display); printf("init %d %d\n", glutGet(GLUT_INIT_WINDOW_WIDTH), glutGet(GLUT_INIT_WINDOW_HEIGHT)); } },
    { "position-half-negative", [] { glutInitWindowPosition(30, -1); printf("init %d %d\n", glutGet(GLUT_INIT_WINDOW_X), glutGet(GLUT_INIT_WINDOW_Y)); } },
    { "destroy-then-call", [] { glutDestroyWindow(glutGetWindow()); printf("window %d\n", glutGetWindow()); glutPostRedisplay(); } },
};

// Cases with glutInit called and no window.
static const Case withoutWindow[] = {
    { "size-refused", [] { glutInitWindowSize(-5, 0); printf("init %d %d\n", glutGet(GLUT_INIT_WINDOW_WIDTH), glutGet(GLUT_INIT_WINDOW_HEIGHT)); } },
    { "position-negative", [] { glutInitWindowPosition(-5, -7); printf("init %d %d\n", glutGet(GLUT_INIT_WINDOW_X), glutGet(GLUT_INIT_WINDOW_Y)); } },
};

template <size_t N>
static const Case* find(const Case (&cases)[N], const char* name) {
    for (const Case& c : cases)
        if (!strcmp(c.name, name)) return &c;
    return nullptr;
}

int main(int argc, char** argv)
{
    setvbuf(stdout, nullptr, _IONBF, 0);
    char name[64] = "";
    if (scanf("%63s", name) != 1) return 2;
    if (const Case* c = find(noInit, name)) {
        c->run();
    } else if (const Case* c = find(noWindow, name)) {
        glutInit(&argc, argv);
        c->run();
    } else if (const Case* c = find(withoutWindow, name)) {
        glutInit(&argc, argv);
        c->run();
    } else if (const Case* c = find(withWindow, name)) {
        glutInit(&argc, argv);
        window();
        c->run();
    } else {
        printf("no case %s\n", name);
        return 2;
    }
    printf("after\n");
    return 0;
}
