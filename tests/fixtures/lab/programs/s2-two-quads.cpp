#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_QUADS_2 = { 0.4500f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_QUADS_1 = { -0.4500f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };

void draw_QUADS_2();
void draw_QUADS_1();
void init();

void draw_QUADS_2()
{
    // QUADS_2
    glPushMatrix();
    // Transform
    glTranslatef(state_QUADS_2.x, state_QUADS_2.y, 0.0f);
    glRotatef(state_QUADS_2.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_QUADS_2.scaleX, state_QUADS_2.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_QUADS);
        glColor3f(0.20f, 0.40f, 1.00f);
        glVertex2f(-0.3000f, -0.3000f);
        glColor3f(0.20f, 0.40f, 1.00f);
        glVertex2f(0.3000f, -0.3000f);
        glColor3f(0.20f, 0.40f, 1.00f);
        glVertex2f(0.3000f, 0.3000f);
        glColor3f(0.20f, 0.40f, 1.00f);
        glVertex2f(-0.3000f, 0.3000f);
    glEnd();
    glPopMatrix();
}

void draw_QUADS_1()
{
    // QUADS_1
    glPushMatrix();
    // Transform
    glTranslatef(state_QUADS_1.x, state_QUADS_1.y, 0.0f);
    glRotatef(state_QUADS_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_QUADS_1.scaleX, state_QUADS_1.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_QUADS);
        glColor3f(1.00f, 0.53f, 0.00f);
        glVertex2f(-0.3000f, -0.3000f);
        glColor3f(1.00f, 0.53f, 0.00f);
        glVertex2f(0.3000f, -0.3000f);
        glColor3f(1.00f, 0.53f, 0.00f);
        glVertex2f(0.3000f, 0.3000f);
        glColor3f(1.00f, 0.53f, 0.00f);
        glVertex2f(-0.3000f, 0.3000f);
    glEnd();
    glPopMatrix();
}

void draw()
{
    draw_QUADS_1();
    draw_QUADS_2();
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

// Mouse callback: glutMouseFunc
void onMouse(int button, int state, int x, int y)
{
    // No rules yet: add them in the Callbacks panel
    glutPostRedisplay();
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
    glutMouseFunc(onMouse);

    glutMainLoop();
    return 0;
}
