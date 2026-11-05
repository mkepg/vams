#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_TRIANGLES_1 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };

void draw_TRIANGLES_1();
void init();

void draw_TRIANGLES_1()
{
    // TRIANGLES_1
    glPushMatrix();
    // Transform
    glTranslatef(state_TRIANGLES_1.x, state_TRIANGLES_1.y, 0.0f);
    glRotatef(state_TRIANGLES_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_TRIANGLES_1.scaleX, state_TRIANGLES_1.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLES);
        glColor3f(1.00f, 0.00f, 0.00f);
        glVertex2f(-0.5000f, -0.3333f);
        glColor3f(0.00f, 1.00f, 0.00f);
        glVertex2f(0.5000f, -0.3333f);
        glColor3f(0.00f, 0.00f, 1.00f);
        glVertex2f(0.0000f, 0.6667f);
    glEnd();
    glPopMatrix();
}

void draw()
{
    draw_TRIANGLES_1();
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);

    // 2D orthographic projection — see glOrtho editor in VAMS
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(-1.0000, 1.0000, -1.0000, 1.0000, -1.0, 1.0);

    // Switch to the modelview stack for object transforms
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();

    draw();
    glutSwapBuffers();
}

// One-time setup, called once before the main loop
void init()
{
    // No VBO primitives to initialise
}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_MULTISAMPLE);
    glutInitWindowSize(500, 500);
    glutCreateWindow("VAMS Preview");

    glewExperimental = GL_TRUE;
    if (glewInit() != GLEW_OK) {
        return 1; // GLEW failed to load OpenGL extensions
    }

    glClearColor(0.00f, 0.00f, 0.00f, 1.0f);

    init();

    glutDisplayFunc(display);

    glutMainLoop();
    return 0;
}
