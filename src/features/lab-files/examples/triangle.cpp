// A triangle: three vertices between glBegin and glEnd, each with its own colour.
// OpenGL blends the colours across the triangle, because the shade model is GL_SMOOTH.
#include <GL/glew.h>
#include <GL/freeglut.h>

void init() {
    glClearColor(0.1f, 0.1f, 0.12f, 1.0f);
    glShadeModel(GL_SMOOTH);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(-1.0, 1.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
}

void display() {
    glClear(GL_COLOR_BUFFER_BIT);
    glBegin(GL_TRIANGLES);
    glColor3f(1.0f, 0.2f, 0.2f);
    glVertex2f(-0.6f, -0.5f);
    glColor3f(0.2f, 1.0f, 0.2f);
    glVertex2f(0.6f, -0.5f);
    glColor3f(0.2f, 0.4f, 1.0f);
    glVertex2f(0.0f, 0.6f);
    glEnd();
    glFlush();
}

int main(int argc, char** argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutInitWindowPosition(100, 100);
    glutCreateWindow("Triangle");
    glewInit();
    init();
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
