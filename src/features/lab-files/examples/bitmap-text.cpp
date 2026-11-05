// Bitmap text. glRasterPos2f sets where the next character goes, in the same coordinates as
// the vertices, and glutBitmapCharacter draws one character there and moves the position on
// by its width. Press a key and the last line shows which one it was.
#include <GL/glew.h>
#include <GL/freeglut.h>

char lastKey = 0;

void init() {
    glClearColor(0.1f, 0.1f, 0.12f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(0.0, 500.0, 0.0, 500.0);   // one unit is one pixel
    glMatrixMode(GL_MODELVIEW);
}

void drawText(float x, float y, void* font, const char* text) {
    glRasterPos2f(x, y);
    for (const char* c = text; *c != '\0'; c++) {
        glutBitmapCharacter(font, *c);
    }
}

void display() {
    glClear(GL_COLOR_BUFFER_BIT);
    glColor3f(1.0f, 0.85f, 0.3f);
    drawText(40.0f, 420.0f, GLUT_BITMAP_TIMES_ROMAN_24, "Hello, OpenGL!");
    glColor3f(1.0f, 1.0f, 1.0f);
    drawText(40.0f, 370.0f, GLUT_BITMAP_HELVETICA_18, "GLUT_BITMAP_HELVETICA_18");
    drawText(40.0f, 340.0f, GLUT_BITMAP_9_BY_15, "GLUT_BITMAP_9_BY_15");
    drawText(40.0f, 315.0f, GLUT_BITMAP_8_BY_13, "GLUT_BITMAP_8_BY_13");

    glColor3f(0.5f, 0.8f, 1.0f);
    if (lastKey) {
        char line[] = "You pressed: ?";
        line[13] = lastKey;
        drawText(40.0f, 240.0f, GLUT_BITMAP_HELVETICA_18, line);
    } else {
        drawText(40.0f, 240.0f, GLUT_BITMAP_HELVETICA_18, "Press a key.");
    }
    glFlush();
}

void keyboard(unsigned char key, int, int) {
    if (key >= 32 && key < 127) {
        lastKey = key;
        glutPostRedisplay();
    }
}

int main(int argc, char** argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_SINGLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutInitWindowPosition(100, 100);
    glutCreateWindow("Bitmap text");
    glewInit();
    init();
    glutDisplayFunc(display);
    glutKeyboardFunc(keyboard);
    glutMainLoop();
    return 0;
}
