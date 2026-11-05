// Width-1 lines that lie on pixel edges or end on pixel corners and centres, one to each
// 40 x 40 cell, which shows which pixels the driver takes when a line is exactly between two.
// Top row, left to right: a horizontal line on a pixel edge, both ways; one through pixel
// centres, both ways; a vertical line on a pixel edge, both ways; one through pixel centres,
// both ways. Bottom row: 45-degree lines through pixel corners, each both ways; one through edge
// midpoints; lines of slope 1/2, -1/2 and 2 through pixel corners. One unit is one pixel.
#include <GL/freeglut.h>

const float lines[16][4] = {
    { 10, 20, 30, 20 },     { 30, 20, 10, 20 },     { 10, 20.5f, 30, 20.5f }, { 30, 20.5f, 10, 20.5f },
    { 20, 10, 20, 30 },     { 20, 30, 20, 10 },     { 20.5f, 10, 20.5f, 30 }, { 20.5f, 30, 20.5f, 10 },
    { 10, 10, 30, 30 },     { 30, 30, 10, 10 },     { 10, 30, 30, 10 },       { 30, 10, 10, 30 },
    { 10.5f, 10, 30.5f, 30 }, { 10, 15, 30, 25 },   { 10, 25, 30, 15 },       { 15, 10, 25, 30 },
};

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);
    glColor3f(1.0f, 1.0f, 1.0f);
    glBegin(GL_LINES);
    for (int i = 0; i < 16; i++) {
        float x = (i % 8) * 40.0f;
        float y = (i < 8) ? 40.0f : 0.0f;
        glVertex2f(x + lines[i][0], y + lines[i][1]);
        glVertex2f(x + lines[i][2], y + lines[i][3]);
    }
    glEnd();
    glutSwapBuffers();
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB);
    glutInitWindowSize(320, 80);
    glutCreateWindow("Line ties");
    glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(0.0, 320.0, 0.0, 80.0, -1.0, 1.0);
    glMatrixMode(GL_MODELVIEW);
    glutDisplayFunc(display);
    glutMainLoop();
    return 0;
}
