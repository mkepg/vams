// Moving a shape with the keyboard. The arrow keys, or W, A, S and D, move the square;
// R puts it back in the middle. Each key changes the position, then glutPostRedisplay asks
// GLUT to call display again, which draws the square at its new place with glTranslatef.
#include <GL/glew.h>
#include <GL/freeglut.h>

float x = 0.0f;
float y = 0.0f;
const float STEP = 0.05f;

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
    glTranslatef(x, y, 0.0f);
    glColor3f(1.0f, 0.75f, 0.2f);
    glBegin(GL_QUADS);
    glVertex2f(-0.1f, -0.1f);
    glVertex2f(0.1f, -0.1f);
    glVertex2f(0.1f, 0.1f);
    glVertex2f(-0.1f, 0.1f);
    glEnd();
    glutSwapBuffers();
}

// Letters and other character keys.
void keyboard(unsigned char key, int, int) {
    switch (key) {
        case 'w': case 'W': y += STEP; break;
        case 's': case 'S': y -= STEP; break;
        case 'a': case 'A': x -= STEP; break;
        case 'd': case 'D': x += STEP; break;
        case 'r': case 'R': x = 0.0f; y = 0.0f; break;
        default: return;
    }
    glutPostRedisplay();
}

// The arrow keys, which GLUT calls special keys.
void special(int key, int, int) {
    switch (key) {
        case GLUT_KEY_UP: y += STEP; break;
        case GLUT_KEY_DOWN: y -= STEP; break;
        case GLUT_KEY_LEFT: x -= STEP; break;
        case GLUT_KEY_RIGHT: x += STEP; break;
        default: return;
    }
    glutPostRedisplay();
}

int main(int argc, char** argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutInitWindowPosition(100, 100);
    glutCreateWindow("Keyboard: arrow keys or WASD, R to reset");
    glewInit();
    init();
    glutDisplayFunc(display);
    glutKeyboardFunc(keyboard);
    glutSpecialFunc(special);
    glutMainLoop();
    return 0;
}
