// Every primitive mode, with multisampling (GLUT_MULTISAMPLE): points, lines, strips and loops, triangles, strips
// and fans, quads and quad strips, and a convex polygon, smooth-shaded at fractional positions,
// then a flat triangle strip and a flat polygon. One unit is one pixel.
#include <GL/freeglut.h>

void colour(int i)
{
    const float c[6][3] = { {1, 0, 0}, {0, 1, 0}, {0, 0, 1}, {1, 1, 0}, {0, 1, 1}, {1, 0, 1} };
    glColor3f(c[i % 6][0], c[i % 6][1], c[i % 6][2]);
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    glShadeModel(GL_SMOOTH);

    glBegin(GL_POINTS);
    for (int i = 0; i < 12; i++) { colour(i); glVertex2f(20.3f + i * 7.7f, 380.6f + (i % 3) * 4.25f); }
    glEnd();

    glBegin(GL_LINES);
    colour(0); glVertex2f(130.4f, 370.2f); colour(1); glVertex2f(230.8f, 395.7f);
    colour(2); glVertex2f(135.5f, 395.5f); colour(3); glVertex2f(180.25f, 352.75f);
    glEnd();
    glBegin(GL_LINE_STRIP);
    for (int i = 0; i < 6; i++) { colour(i); glVertex2f(250.3f + i * 18.4f, 360.6f + (i % 2) * 30.2f); }
    glEnd();
    glBegin(GL_LINE_LOOP);
    for (int i = 0; i < 5; i++) { colour(i); glVertex2f(420.5f + 40.0f * (i == 1 || i == 2) - 10.0f * (i == 4), 355.3f + 15.7f * i); }
    glEnd();

    glBegin(GL_TRIANGLES);
    colour(0); glVertex2f(20.4f, 240.6f); colour(1); glVertex2f(110.2f, 250.3f); colour(2); glVertex2f(60.7f, 330.9f);
    colour(3); glVertex2f(30.1f, 230.2f); colour(4); glVertex2f(120.6f, 300.1f); colour(5); glVertex2f(118.3f, 228.8f);
    glEnd();
    glBegin(GL_TRIANGLE_STRIP);
    for (int i = 0; i < 7; i++) { colour(i); glVertex2f(140.2f + i * 22.3f, 240.4f + (i % 2) * 75.5f); }
    glEnd();
    glBegin(GL_TRIANGLE_FAN);
    colour(0); glVertex2f(370.5f, 280.5f);
    for (int i = 0; i < 6; i++) { colour(i + 1); glVertex2f(370.5f + 60.0f * (i < 3 ? 1.0f : -1.0f) * (i % 3 == 1 ? 1.0f : 0.5f), 280.5f + 45.0f * (i % 3 == 0 ? 1.0f : (i % 3 == 1 ? 0.0f : -1.0f))); }
    glEnd();

    glBegin(GL_QUADS);
    colour(0); glVertex2f(20.6f, 110.3f); colour(1); glVertex2f(130.2f, 120.7f);
    colour(2); glVertex2f(120.4f, 205.5f); colour(3); glVertex2f(25.9f, 195.1f);
    glEnd();
    glBegin(GL_QUAD_STRIP);
    for (int i = 0; i < 8; i++) { colour(i); glVertex2f(150.3f + (i / 2) * 40.1f, 110.2f + (i % 2) * 90.6f + (i / 2) * 3.3f); }
    glEnd();
    glBegin(GL_POLYGON);
    for (int i = 0; i < 6; i++) {
        colour(i);
        const float dx[6] = { 0, 50, 75, 50, 0, -25 }, dy[6] = { 0, -5, 40, 90, 85, 40 };
        glVertex2f(360.3f + dx[i], 110.6f + dy[i]);
    }
    glEnd();

    glShadeModel(GL_FLAT);
    glBegin(GL_TRIANGLE_STRIP);
    for (int i = 0; i < 6; i++) { colour(i); glVertex2f(20.2f + i * 30.5f, 20.4f + (i % 2) * 60.3f); }
    glEnd();
    glBegin(GL_POLYGON);
    for (int i = 0; i < 5; i++) {
        colour(i + 2);
        const float dx[5] = { 0, 70, 90, 45, -10 }, dy[5] = { 0, 5, 50, 80, 45 };
        glVertex2f(250.7f + dx[i], 15.3f + dy[i]);
    }
    glEnd();
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_MULTISAMPLE);
    glutInitWindowSize(500, 420);
    glutCreateWindow("Every mode, multisampled");
    glClearColor(0.05f, 0.05f, 0.1f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 500.0, 0.0, 420.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
