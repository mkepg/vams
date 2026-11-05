// Points of size 1 to 8. The top row sits on pixel centres (x.5, y.5), the bottom row on
// pixel corners (whole numbers). One unit is one pixel.
#include <GL/freeglut.h>

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    for (int size = 1; size <= 8; size++) {
        float x = 40.0f + (size - 1) * 60.0f;
        glPointSize((float)size);
        glBegin(GL_POINTS);
        glColor3f(1.0f, 1.0f, 0.0f);
        glVertex2f(x + 0.5f, 350.5f);
        glColor3f(0.0f, 1.0f, 1.0f);
        glVertex2f(x, 150.0f);
        glEnd();
    }
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutCreateWindow("Points");
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 500.0, 0.0, 500.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
