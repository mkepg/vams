// Wide lines: one row for each width (1, 2, 3, 4.5 and 8 pixels), and in each row a line
// at 0, 30, 45 and 90 degrees. One unit is one pixel.
#include <GL/freeglut.h>
#include <cmath>

const float widths[] = { 1.0f, 2.0f, 3.0f, 4.5f, 8.0f };
const float angles[] = { 0.0f, 30.0f, 45.0f, 90.0f };

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    for (int row = 0; row < 5; row++) {
        glLineWidth(widths[row]);
        glColor3f(1.0f, 0.2f * row, 1.0f - 0.2f * row);
        for (int col = 0; col < 4; col++) {
            float a = angles[col] * 3.14159265f / 180.0f;
            float cx = 62.5f + col * 125.0f;
            float cy = 450.0f - row * 100.0f;
            float dx = 40.0f * cos(a), dy = 40.0f * sin(a);
            glBegin(GL_LINES);
            glVertex2f(cx - dx, cy - dy);
            glVertex2f(cx + dx, cy + dy);
            glEnd();
        }
    }
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(500, 500);
    glutCreateWindow("Wide lines");
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 500.0, 0.0, 500.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
