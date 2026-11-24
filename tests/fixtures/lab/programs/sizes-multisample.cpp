// Point sizes and line widths, with multisampling (GLUT_MULTISAMPLE): points of size 1, 2.5, 8 and 20 at
// fractional centres; then lines of width 1, 2.5 and 6 at 0, 30, 60 and 90 degrees, plain, with
// stipple (1, 0x0F0F) and with stipple (3, 0x00FF). One unit is one pixel.
#include <GL/freeglut.h>
#include <cmath>

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    const float sizes[4] = { 1.0f, 2.5f, 8.0f, 20.0f };
    for (int i = 0; i < 4; i++) {
        glPointSize(sizes[i]);
        glColor3f(1.0f, 0.9f - 0.2f * i, 0.2f * i);
        glBegin(GL_POINTS);
        for (int k = 0; k < 4; k++) glVertex2f(30.0f + i * 120.0f + k * 25.3f + k * 0.17f, 470.0f + k * 0.31f);
        glEnd();
    }
    glPointSize(1.0f);

    const float widths[3] = { 1.0f, 2.5f, 6.0f };
    const float angles[4] = { 0.0f, 30.0f, 60.0f, 90.0f };
    for (int s = 0; s < 3; s++) {
        if (s == 1) { glEnable(GL_LINE_STIPPLE); glLineStipple(1, 0x0F0F); }
        if (s == 2) { glEnable(GL_LINE_STIPPLE); glLineStipple(3, 0x00FF); }
        for (int w = 0; w < 3; w++) {
            glLineWidth(widths[w]);
            glColor3f(0.3f + 0.3f * w, 0.9f - 0.3f * s, 1.0f);
            for (int a = 0; a < 4; a++) {
                float r = angles[a] * 3.14159265f / 180.0f;
                float x = 20.3f + w * 165.0f + a * 38.0f;
                float y = 20.6f + s * 140.0f;
                glBegin(GL_LINES);
                glVertex2f(x, y);
                glVertex2f(x + 70.0f * cosf(r), y + 110.0f * sinf(r));
                glEnd();
            }
        }
        glDisable(GL_LINE_STIPPLE);
    }
    glLineWidth(1.0f);
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_MULTISAMPLE);
    glutInitWindowSize(500, 500);
    glutCreateWindow("Sizes, multisampled");
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 500.0, 0.0, 500.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
