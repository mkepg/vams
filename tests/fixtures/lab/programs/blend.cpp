// Blending in a single-buffered window. Left: three half-transparent squares over each
// other (GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA). Middle: three squares added together
// (GL_ONE, GL_ONE). Right: a grey square that darkens what is under it (GL_DST_COLOR,
// GL_ZERO), over a colour ramp. One unit is one pixel.
#include <GL/freeglut.h>

void square(float x, float y, float size)
{
    glRectf(x, y, x + size, y + size);
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    glEnable(GL_BLEND);

    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glColor4f(1.0f, 0.0f, 0.0f, 0.5f); square(20, 260, 110);
    glColor4f(0.0f, 1.0f, 0.0f, 0.5f); square(70, 200, 110);
    glColor4f(0.0f, 0.0f, 1.0f, 0.75f); square(40, 150, 110);

    glBlendFunc(GL_ONE, GL_ONE);
    glColor3f(0.8f, 0.0f, 0.0f); square(190, 260, 110);
    glColor3f(0.0f, 0.8f, 0.0f); square(240, 200, 110);
    glColor3f(0.0f, 0.0f, 0.8f); square(210, 150, 110);

    glDisable(GL_BLEND);
    glShadeModel(GL_SMOOTH);
    glBegin(GL_QUADS);
    glColor3f(1.0f, 1.0f, 0.0f); glVertex2f(360, 150);
    glColor3f(0.0f, 1.0f, 1.0f); glVertex2f(480, 150);
    glColor3f(1.0f, 0.0f, 1.0f); glVertex2f(480, 370);
    glColor3f(1.0f, 1.0f, 1.0f); glVertex2f(360, 370);
    glEnd();
    glEnable(GL_BLEND);
    glBlendFunc(GL_DST_COLOR, GL_ZERO);
    glColor3f(0.5f, 0.5f, 0.5f); square(390, 200, 110);

    glDisable(GL_BLEND);
    glFlush();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutCreateWindow("Blending");
    glClearColor(0.1f, 0.1f, 0.15f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 500.0, 0.0, 500.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
