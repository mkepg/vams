// State that changes what a shape draws, multisampled: polygon mode for front and back faces,
// blending (half-transparent and added) over a smooth gradient, the scissor test, two viewports
// with their own projections, and nested transforms with odd angles and uneven scales.
#include <GL/freeglut.h>

void triangle(float x, float y, bool clockwise)
{
    glBegin(GL_TRIANGLES);
    glColor3f(1.0f, 0.4f, 0.2f); glVertex2f(x, y);
    glColor3f(0.2f, 1.0f, 0.4f);
    if (clockwise) glVertex2f(x + 30.5f, y + 70.25f); else glVertex2f(x + 80.75f, y + 10.5f);
    glColor3f(0.3f, 0.5f, 1.0f);
    if (clockwise) glVertex2f(x + 80.75f, y + 10.5f); else glVertex2f(x + 30.5f, y + 70.25f);
    glEnd();
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    glViewport(0, 0, 600, 450);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 600.0, 0.0, 450.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    glShadeModel(GL_SMOOTH);

    glPolygonMode(GL_FRONT, GL_LINE);
    glPolygonMode(GL_BACK, GL_POINT);
    glPointSize(4.0f);
    triangle(20.3f, 350.6f, false);
    triangle(120.6f, 350.2f, true);
    glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);
    glPointSize(1.0f);

    glBegin(GL_QUADS);
    glColor3f(0.0f, 0.0f, 0.0f); glVertex2f(230, 330);
    glColor3f(1.0f, 1.0f, 1.0f); glVertex2f(580, 330);
    glColor3f(0.0f, 0.5f, 1.0f); glVertex2f(580, 440);
    glColor3f(1.0f, 0.5f, 0.0f); glVertex2f(230, 440);
    glEnd();
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    glColor4f(1.0f, 0.2f, 0.6f, 0.35f);
    glRectf(250.4f, 345.7f, 400.2f, 425.1f);
    glBlendFunc(GL_ONE, GL_ONE);
    glColor3f(0.2f, 0.3f, 0.1f);
    glRectf(380.6f, 340.3f, 560.5f, 420.9f);
    glDisable(GL_BLEND);

    glEnable(GL_SCISSOR_TEST);
    glScissor(30, 200, 150, 90);
    glClearColor(0.25f, 0.1f, 0.3f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);
    glColor3f(1.0f, 1.0f, 0.3f);
    glBegin(GL_TRIANGLES);
    glVertex2f(10.5f, 190.5f); glVertex2f(220.5f, 230.5f); glVertex2f(60.5f, 320.5f);
    glEnd();
    glDisable(GL_SCISSOR_TEST);
    glClearColor(0.05f, 0.05f, 0.08f, 1.0f);

    for (int k = 0; k < 4; k++) {
        glPushMatrix();
        glTranslatef(330.0f + k * 70.0f, 250.0f, 0.0f);
        glRotatef(17.3f * (k + 1), 0.0f, 0.0f, 1.0f);
        glScalef(1.0f + 0.3f * k, 0.6f, 1.0f);
        glPushMatrix();
        glRotatef(-9.7f, 0.0f, 0.0f, 1.0f);
        glColor3f(0.3f * k, 0.9f, 1.0f - 0.2f * k);
        glRectf(-20.0f, -15.0f, 20.0f, 15.0f);
        glPopMatrix();
        glColor3f(1.0f, 1.0f, 1.0f);
        glBegin(GL_LINE_LOOP);
        glVertex2f(-25.0f, -20.0f); glVertex2f(25.0f, -20.0f); glVertex2f(25.0f, 20.0f); glVertex2f(-25.0f, 20.0f);
        glEnd();
        glPopMatrix();
    }

    glViewport(20, 20, 260, 150);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(-1.3, 1.3, -0.75, 0.75, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();
    glBegin(GL_TRIANGLE_FAN);
    glColor3f(1.0f, 1.0f, 1.0f); glVertex2f(0.0f, 0.0f);
    glColor3f(1.0f, 0.0f, 0.0f); glVertex2f(1.5f, 0.0f);
    glColor3f(0.0f, 1.0f, 0.0f); glVertex2f(0.0f, 1.0f);
    glColor3f(0.0f, 0.0f, 1.0f); glVertex2f(-1.5f, 0.0f);
    glColor3f(1.0f, 1.0f, 0.0f); glVertex2f(0.0f, -1.0f);
    glColor3f(1.0f, 0.0f, 0.0f); glVertex2f(1.5f, 0.0f);
    glEnd();
    glViewport(320, 20, 260, 150);
    glLineWidth(3.0f);
    glBegin(GL_LINE_STRIP);
    glColor3f(0.4f, 1.0f, 0.6f); glVertex2f(-1.6f, -0.9f);
    glColor3f(1.0f, 0.4f, 0.6f); glVertex2f(0.2f, 0.95f);
    glColor3f(0.6f, 0.4f, 1.0f); glVertex2f(1.7f, -0.5f);
    glEnd();
    glLineWidth(1.0f);
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_MULTISAMPLE);
    glutInitWindowSize(600, 450);
    glutCreateWindow("State");
    glClearColor(0.05f, 0.05f, 0.08f, 1.0f);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
