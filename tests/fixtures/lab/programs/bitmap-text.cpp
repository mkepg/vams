// The seven GLUT bitmap fonts. Each font prints every character it draws: 33 to 126, then
// 161 to 255, 48 characters to a line. One unit is one pixel.
#include <GL/freeglut.h>

void* fonts[] = {
    GLUT_BITMAP_9_BY_15, GLUT_BITMAP_8_BY_13, GLUT_BITMAP_TIMES_ROMAN_10, GLUT_BITMAP_TIMES_ROMAN_24,
    GLUT_BITMAP_HELVETICA_10, GLUT_BITMAP_HELVETICA_12, GLUT_BITMAP_HELVETICA_18,
};
const int lineHeights[] = { 15, 13, 13, 26, 13, 15, 22 };

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    glColor3f(1.0f, 1.0f, 1.0f);
    int y = 640;
    for (int f = 0; f < 7; f++) {
        int c = 33;
        for (int line = 0; line < 4; line++) {
            y -= lineHeights[f] + 2;
            glRasterPos2i(8, y);
            for (int n = 0; n < 48 && c <= 255; n++) {
                glutBitmapCharacter(fonts[f], c);
                c = (c == 126) ? 161 : c + 1;
            }
        }
        y -= 6;
    }
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(720, 640);
    glutCreateWindow("Bitmap fonts");
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 720.0, 0.0, 640.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
