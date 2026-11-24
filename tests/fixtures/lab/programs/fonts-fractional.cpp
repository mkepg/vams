// The seven GLUT bitmap fonts at fractional raster positions under a projection whose units are
// not whole pixels (glOrtho over 641 × 397 units in a 600 × 400 window), so each line's raster
// position works out a fraction of a pixel from where it was asked for.
#include <GL/freeglut.h>

void* fonts[] = {
    GLUT_BITMAP_9_BY_15, GLUT_BITMAP_8_BY_13, GLUT_BITMAP_TIMES_ROMAN_10, GLUT_BITMAP_TIMES_ROMAN_24,
    GLUT_BITMAP_HELVETICA_10, GLUT_BITMAP_HELVETICA_12, GLUT_BITMAP_HELVETICA_18,
};

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    for (int f = 0; f < 7; f++) {
        glColor3f(1.0f, 1.0f - 0.1f * f, 0.5f + 0.07f * f);
        glRasterPos2f(10.37f + f * 3.11f, 370.61f - f * 52.3f);
        glutBitmapString(fonts[f], (const unsigned char*)"VAMS Lab: glRasterPos2f(10.37, 370.61)\nsecond line, 0123456789");
    }
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(600, 400);
    glutCreateWindow("Fonts");
    glClearColor(0.1f, 0.12f, 0.2f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 641.0, 0.0, 397.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
