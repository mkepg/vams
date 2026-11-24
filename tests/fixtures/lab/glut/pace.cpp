// How often GLUT runs a program's timers and idle callback, measured in one window: a timer of 1,
// 10, 16 and 33 ms rearming itself for about a second each, then an idle callback that posts a
// redisplay, with a double-buffered display that clears and swaps. Prints one line per measure and
// exits.
//
// On the reference (GLUT behaviour spec, 24 Nov 2026), with the window in front, timers kept their
// time (16 ms every 16.4 ms) and idle wasn't held to the screen (about 1,750 frames a second).
// FreeGLUT asks Windows for 1 ms timers, and Windows 11 keeps that only while the window can be
// seen, so the figures aren't recorded by a script on a shared desktop.
#include <GL/freeglut.h>
#include <cstdio>
#include <cstdlib>

static const int periods[] = { 1, 10, 16, 33 };
static int phase = 0, count = 0, start = 0;

static void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    glutSwapBuffers();
    if (phase == 4) count++;
}

static void begin()
{
    count = 0;
    start = glutGet(GLUT_ELAPSED_TIME);
}

static void idle()
{
    glutPostRedisplay();
    if (glutGet(GLUT_ELAPSED_TIME) - start < 1000) return;
    printf("idle frames per second %d\n", count * 1000 / (glutGet(GLUT_ELAPSED_TIME) - start));
    exit(0);
}

static void timer(int p)
{
    if (p != phase) return;
    count++;
    int elapsed = glutGet(GLUT_ELAPSED_TIME) - start;
    if (elapsed < 1000) {
        glutTimerFunc(periods[phase], timer, phase);
        return;
    }
    // Hundredths of a millisecond, so the mean keeps its fraction.
    printf("timer %d ms: mean %d.%02d ms\n", periods[phase], elapsed * 100 / count / 100, elapsed * 100 / count % 100);
    phase++;
    begin();
    if (phase < 4) glutTimerFunc(periods[phase], timer, phase);
    else glutIdleFunc(idle);
}

int main(int argc, char** argv)
{
    setvbuf(stdout, NULL, _IONBF, 0);
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(300, 300);
    glutCreateWindow("Pace");
    glClearColor(0.1f, 0.2f, 0.3f, 1.0f);
    glutDisplayFunc(display);
    begin();
    glutTimerFunc(periods[0], timer, 0);
    glutMainLoop();
    return 0;
}
