// Display lists. A petal is compiled once (GL_COMPILE); a flower list calls the petal list
// six times, turning between calls; display() calls the flower list at four places and
// sizes. The stem list is built with GL_COMPILE_AND_EXECUTE, so it also draws once in
// init(), before the first clear. One unit is one pixel.
#include <GL/freeglut.h>

GLuint petal, flower, stem;

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    const float xs[] = { 110, 250, 390, 250 };
    const float ys[] = { 330, 380, 330, 150 };
    const float sizes[] = { 0.8f, 1.0f, 0.8f, 1.4f };
    for (int i = 0; i < 4; i++) {
        glPushMatrix();
        glTranslatef(xs[i], ys[i], 0.0f);
        glScalef(sizes[i], sizes[i], 1.0f);
        glCallList(stem);
        glCallList(flower);
        glPopMatrix();
    }
    glutSwapBuffers();
}

void init()
{
    petal = glGenLists(3);
    flower = petal + 1;
    stem = petal + 2;

    glNewList(petal, GL_COMPILE);
    glBegin(GL_TRIANGLES);
    glColor3f(1.0f, 0.5f, 0.7f); glVertex2f(0, 0);
    glColor3f(1.0f, 0.9f, 0.9f); glVertex2f(45, 12);
    glColor3f(1.0f, 0.9f, 0.9f); glVertex2f(45, -12);
    glEnd();
    glEndList();

    glNewList(flower, GL_COMPILE);
    for (int i = 0; i < 6; i++) {
        glCallList(petal);
        glRotatef(60.0f, 0.0f, 0.0f, 1.0f);
    }
    glColor3f(1.0f, 0.85f, 0.2f);
    glRectf(-8, -8, 8, 8);
    glEndList();

    glNewList(stem, GL_COMPILE_AND_EXECUTE);
    glLineWidth(3.0f);
    glColor3f(0.3f, 0.7f, 0.3f);
    glBegin(GL_LINES);
    glVertex2f(0, 0);
    glVertex2f(0, -90);
    glEnd();
    glEndList();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutCreateWindow("Display lists");
    glClearColor(0.05f, 0.1f, 0.2f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 500.0, 0.0, 500.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    init();
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
