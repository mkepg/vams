// Every input callback, one line each with its values and glutGetModifiers(), for comparing how
// FreeGLUT and the Lab hand a program its keys and mouse. events.script.txt lists what is done to
// the window: in the Lab a browser does it; on the reference the program does it to itself.
//
// On the reference (built with MinGW) the program reads the script named by VAMS_EVENTS_SCRIPT and
// posts each key and mouse message to its own window from a timer, one message a tick, setting the
// keyboard state each message needs first. FreeGLUT's own window procedure handles them, through
// TranslateMessage as real input is, and nothing moves the real cursor or types on the desktop.
#include <GL/freeglut.h>
#include <cstdio>

static void key(unsigned char k, int x, int y) { printf("keyboard %d %d %d mods %d\n", k, x, y, glutGetModifiers()); }
static void keyUp(unsigned char k, int x, int y) { printf("keyboardUp %d %d %d mods %d\n", k, x, y, glutGetModifiers()); }
static void special(int k, int x, int y) { printf("special %d %d %d mods %d\n", k, x, y, glutGetModifiers()); }
static void specialUp(int k, int x, int y) { printf("specialUp %d %d %d mods %d\n", k, x, y, glutGetModifiers()); }
static void mouse(int b, int s, int x, int y) { printf("mouse %d %d %d %d mods %d\n", b, s, x, y, glutGetModifiers()); }
static void motion(int x, int y) { printf("motion %d %d\n", x, y); }
static void passive(int x, int y) { printf("passive %d %d\n", x, y); }
static void reshape(int w, int h) { printf("reshape %d %d\n", w, h); glViewport(0, 0, w, h); }
static void closed() { printf("close\n"); }
static void display() { glClear(GL_COLOR_BUFFER_BIT); glutSwapBuffers(); }

#ifdef __MINGW32__
#include <windows.h>
#include <cstdlib>
#include <cstring>
#include <vector>

// One posted message, with the keys held while it is handled.
struct Message {
    UINT msg;
    WPARAM wParam;
    LPARAM lParam;
    bool shift, control;
};
static std::vector<Message> messages;
static size_t next = 0;
static HWND window;

static LPARAM at(int x, int y) { return MAKELPARAM(x, y); }

static LPARAM keyBits(UINT vk, bool up) {
    UINT scan = MapVirtualKeyA(vk, MAPVK_VK_TO_VSC);
    bool extended = vk == VK_LEFT || vk == VK_RIGHT || vk == VK_UP || vk == VK_DOWN || vk == VK_PRIOR || vk == VK_NEXT ||
                    vk == VK_HOME || vk == VK_END || vk == VK_INSERT || vk == VK_DELETE;
    return 1 | (scan << 16) | (extended ? 1 << 24 : 0) | (up ? (1u << 30) | (1u << 31) : 0);
}

static UINT keyCode(const char* code) {
    if (!strncmp(code, "Key", 3)) return (UINT)code[3];
    if (!strncmp(code, "Digit", 5)) return (UINT)code[5];
    if (code[0] == 'F' && code[1] >= '0' && code[1] <= '9') return VK_F1 + atoi(code + 1) - 1;
    static const struct { const char* name; UINT vk; } named[] = {
        { "Semicolon", VK_OEM_1 }, { "Space", VK_SPACE }, { "Enter", VK_RETURN }, { "Escape", VK_ESCAPE },
        { "Backspace", VK_BACK }, { "Delete", VK_DELETE }, { "Tab", VK_TAB }, { "ArrowLeft", VK_LEFT },
        { "ArrowUp", VK_UP }, { "ArrowRight", VK_RIGHT }, { "ArrowDown", VK_DOWN }, { "PageUp", VK_PRIOR },
        { "PageDown", VK_NEXT }, { "Home", VK_HOME }, { "End", VK_END }, { "Insert", VK_INSERT },
    };
    for (const auto& n : named) if (!strcmp(code, n.name)) return n.vk;
    fprintf(stderr, "no key %s\n", code);
    exit(3);
}

static void add(UINT msg, WPARAM w, LPARAM l, bool shift = false, bool control = false) {
    messages.push_back({ msg, w, l, shift, control });
}

static void readScript(const char* path) {
    FILE* f = fopen(path, "r");
    if (!f) { fprintf(stderr, "can't read %s\n", path); exit(3); }
    char line[128];
    while (fgets(line, sizeof line, f)) {
        char what[32] = "", arg[64] = "";
        int a = 0, b = 0, c = 0, d = 0;
        if (sscanf(line, "%31s", what) != 1) continue;
        if (!strcmp(what, "click") && sscanf(line, "%*s %d %d", &a, &b) == 2) {
            add(WM_MOUSEMOVE, 0, at(a, b));
            add(WM_LBUTTONDOWN, MK_LBUTTON, at(a, b));
            add(WM_LBUTTONUP, 0, at(a, b));
        } else if (!strcmp(what, "middle") && sscanf(line, "%*s %d %d", &a, &b) == 2) {
            add(WM_MOUSEMOVE, 0, at(a, b));
            add(WM_MBUTTONDOWN, MK_MBUTTON, at(a, b));
            add(WM_MBUTTONUP, 0, at(a, b));
        } else if (!strcmp(what, "move") && sscanf(line, "%*s %d %d", &a, &b) == 2) {
            add(WM_MOUSEMOVE, 0, at(a, b));
        } else if (!strcmp(what, "drag") && sscanf(line, "%*s %d %d %d %d", &a, &b, &c, &d) == 4) {
            add(WM_MOUSEMOVE, 0, at(a, b));
            add(WM_LBUTTONDOWN, MK_LBUTTON, at(a, b));
            add(WM_MOUSEMOVE, MK_LBUTTON, at(c, d));
            add(WM_LBUTTONUP, 0, at(c, d));
        } else if (!strcmp(what, "wheel") && sscanf(line, "%*s %63s %d %d", arg, &a, &b) == 3) {
            add(WM_MOUSEMOVE, 0, at(a, b));
            POINT p = { a, b };
            ClientToScreen(window, &p);
            add(WM_MOUSEWHEEL, MAKEWPARAM(0, !strcmp(arg, "up") ? WHEEL_DELTA : -WHEEL_DELTA), MAKELPARAM(p.x, p.y));
        } else if (!strcmp(what, "key") && sscanf(line, "%*s %63s", arg) == 1) {
            bool shift = strstr(arg, "Shift+") != NULL, control = strstr(arg, "Control+") != NULL;
            const char* code = strrchr(arg, '+') ? strrchr(arg, '+') + 1 : arg;
            UINT vk = keyCode(code);
            if (shift) add(WM_KEYDOWN, VK_SHIFT, keyBits(VK_SHIFT, false), true, control);
            if (control) add(WM_KEYDOWN, VK_CONTROL, keyBits(VK_CONTROL, false), shift, true);
            add(WM_KEYDOWN, vk, keyBits(vk, false), shift, control);
            add(WM_KEYUP, vk, keyBits(vk, true), shift, control);
            if (control) add(WM_KEYUP, VK_CONTROL, keyBits(VK_CONTROL, true), shift, false);
            if (shift) add(WM_KEYUP, VK_SHIFT, keyBits(VK_SHIFT, true), false, false);
        } else if (!strcmp(what, "close")) {
            add(WM_CLOSE, 0, 0);
        }
    }
    fclose(f);
}

static void step(int) {
    if (next >= messages.size()) return;
    const Message& m = messages[next++];
    BYTE keys[256];
    GetKeyboardState(keys);
    keys[VK_SHIFT] = keys[VK_LSHIFT] = m.shift ? 0x80 : 0;
    keys[VK_CONTROL] = keys[VK_LCONTROL] = m.control ? 0x80 : 0;
    SetKeyboardState(keys);
    PostMessageA(window, m.msg, m.wParam, m.lParam);
    glutTimerFunc(15, step, 0);
}

static void drive() {
    window = FindWindowA(NULL, "Events");
    const char* script = getenv("VAMS_EVENTS_SCRIPT");
    if (!window || !script) { fprintf(stderr, "no window or no VAMS_EVENTS_SCRIPT\n"); exit(3); }
    readScript(script);
    glutTimerFunc(300, step, 0);
}
#else
static void drive() {}
#endif

int main(int argc, char** argv)
{
    setvbuf(stdout, NULL, _IONBF, 0);
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(400, 300);
    glutCreateWindow("Events");
    glutDisplayFunc(display);
    glutReshapeFunc(reshape);
    glutKeyboardFunc(key);
    glutKeyboardUpFunc(keyUp);
    glutSpecialFunc(special);
    glutSpecialUpFunc(specialUp);
    glutMouseFunc(mouse);
    glutMotionFunc(motion);
    glutPassiveMotionFunc(passive);
    glutCloseFunc(closed);
    drive();
    glutMainLoop();
    return 0;
}
