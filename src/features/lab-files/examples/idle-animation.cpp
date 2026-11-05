// An idle animation. GLUT calls idle whenever it has nothing else to do. idle works out how
// much time has passed with glutGet(GLUT_ELAPSED_TIME), turns the square by that much, and asks
// for a redraw, so the square turns at the same speed on a fast PC and a slow one.
#include <GL/glew.h>
#include <GL/freeglut.h>

float angle = 0.0f;           // degrees
const float SPEED = 90.0f;    // degrees a second
int lastTime = 0;             // milliseconds

void init() {
    glClearColor(0.1f, 0.1f, 0.12f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(-1.0, 1.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
}

void display() {
    glClear(GL_COLOR_BUFFER_BIT);
    glLoadIdentity();
    glRotatef(angle, 0.0f, 0.0f, 1.0f);
    glBegin(GL_QUADS);
    glColor3f(0.2f, 0.6f, 1.0f);
    glVertex2f(-0.4f, -0.4f);
    glVertex2f(0.4f, -0.4f);
    glColor3f(1.0f, 1.0f, 1.0f);
    glVertex2f(0.4f, 0.4f);
    glVertex2f(-0.4f, 0.4f);
    glEnd();
    glutSwapBuffers();
}

void idle() {
    int now = glutGet(GLUT_ELAPSED_TIME);
    float seconds = (now - lastTime) / 1000.0f;
    lastTime = now;
    angle += SPEED * seconds;
    if (angle >= 360.0f) angle -= 360.0f;
    glutPostRedisplay();
}

int main(int argc, char** argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutInitWindowPosition(100, 100);
    glutCreateWindow("Idle animation");
    glewInit();
    init();
    lastTime = glutGet(GLUT_ELAPSED_TIME);
    glutDisplayFunc(display);
    glutIdleFunc(idle);
    glutMainLoop();
    return 0;
}
