// Stippled lines: four factor and pattern pairs, each on GL_LINES (the pattern restarts at
// every segment) and on a GL_LINE_STRIP (it runs on through the corners). The last two lines
// share a pattern: one starts off the left edge of the window and one starts on it.
#include <GL/freeglut.h>

const int factors[] = { 1, 2, 3, 4 };
const unsigned short patterns[] = { 0x0F0F, 0xAAAA, 0x1C47, 0x00FF };

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    glEnable(GL_LINE_STIPPLE);
    for (int i = 0; i < 4; i++) {
        float y = 460.0f - i * 100.0f;
        glLineStipple(factors[i], patterns[i]);
        glColor3f(1.0f, 1.0f, 1.0f);
        glBegin(GL_LINES);
        glVertex2f(20.0f, y);
        glVertex2f(230.0f, y);
        glVertex2f(20.0f, y - 30.0f);
        glVertex2f(230.0f, y - 50.0f);
        glEnd();
        glColor3f(0.3f, 0.9f, 1.0f);
        glBegin(GL_LINE_STRIP);
        glVertex2f(270.0f, y);
        glVertex2f(370.0f, y - 50.0f);
        glVertex2f(480.0f, y);
        glEnd();
    }
    glLineStipple(4, 0x00FF);
    glColor3f(1.0f, 0.8f, 0.2f);
    glBegin(GL_LINES);
    glVertex2f(-91.0f, 40.5f);
    glVertex2f(480.0f, 40.5f);
    glVertex2f(0.0f, 20.5f);
    glVertex2f(480.0f, 20.5f);
    glEnd();
    glDisable(GL_LINE_STIPPLE);
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutCreateWindow("Stippled lines");
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 500.0, 0.0, 500.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
