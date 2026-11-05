// glPolygonMode. Top left: a filled front face beside an outlined back face (GL_BACK in
// GL_LINE). Top right: a polygon drawn as its corner points (GL_POINT). Middle: outlined
// diamonds that cross the left and right edges of the window. Bottom: an outlined diamond
// in a small viewport, crossing that viewport's edges. One unit is one pixel.
#include <GL/freeglut.h>

void diamond(float cx, float cy, float r)
{
    glBegin(GL_QUADS);
    glVertex2f(cx, cy - r);
    glVertex2f(cx + r, cy);
    glVertex2f(cx, cy + r);
    glVertex2f(cx - r, cy);
    glEnd();
}

void view(int x, int y, int w, int h, double left, double right, double bottom, double top)
{
    glViewport(x, y, w, h);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(left, right, bottom, top, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    view(0, 0, 500, 500, 0.0, 500.0, 0.0, 500.0);

    glPolygonMode(GL_FRONT, GL_FILL);
    glPolygonMode(GL_BACK, GL_LINE);
    glColor3f(0.2f, 0.8f, 0.3f);
    glBegin(GL_TRIANGLES);
    glVertex2f(30, 360); glVertex2f(130, 360); glVertex2f(80, 460);   // counter-clockwise: front
    glVertex2f(150, 360); glVertex2f(200, 460); glVertex2f(250, 360); // clockwise: back
    glEnd();

    glPointSize(5.0f);
    glPolygonMode(GL_FRONT_AND_BACK, GL_POINT);
    glColor3f(1.0f, 0.8f, 0.2f);
    glBegin(GL_POLYGON);
    glVertex2f(300, 380); glVertex2f(380, 360); glVertex2f(460, 400);
    glVertex2f(420, 460); glVertex2f(330, 450);
    glEnd();

    glPolygonMode(GL_FRONT_AND_BACK, GL_LINE);
    glColor3f(1.0f, 1.0f, 1.0f);
    diamond(30, 250, 70);
    diamond(470, 250, 70);
    diamond(250, 250, 60);

    view(175, 25, 150, 120, -1.0, 1.0, -1.0, 1.0);
    glColor3f(0.4f, 0.7f, 1.0f);
    diamond(0.0f, 0.0f, 1.3f);

    glPolygonMode(GL_FRONT_AND_BACK, GL_FILL);
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutCreateWindow("Polygon mode");
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
