#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_TRIANGLE_STRIP_1 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };

// --- Buffer Data ---
GLfloat verts_TRIANGLE_STRIP_1[] = { -0.6000f, -0.3000f, -0.6000f, 0.3000f, 0.0000f, -0.3000f, 0.0000f, 0.3000f, 0.6000f, -0.3000f, 0.6000f, 0.3000f };
GLfloat colors_TRIANGLE_STRIP_1[] = { 1.00f, 0.00f, 0.00f, 0.00f, 1.00f, 0.00f, 0.00f, 0.00f, 1.00f, 1.00f, 1.00f, 0.00f, 1.00f, 0.00f, 1.00f, 0.00f, 1.00f, 1.00f };
GLuint indices_TRIANGLE_STRIP_1[] = { 0, 1, 2, 3, 4, 5 };

void draw_TRIANGLE_STRIP_1();
void init();

void draw_TRIANGLE_STRIP_1()
{
    // TRIANGLE_STRIP_1
    glPushMatrix();
    glTranslatef(state_TRIANGLE_STRIP_1.x, state_TRIANGLE_STRIP_1.y, 0.0f);
    glRotatef(state_TRIANGLE_STRIP_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_TRIANGLE_STRIP_1.scaleX, state_TRIANGLE_STRIP_1.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind client-side arrays
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);
    glVertexPointer(2, GL_FLOAT, 0, verts_TRIANGLE_STRIP_1);
    glColorPointer(3, GL_FLOAT, 0, colors_TRIANGLE_STRIP_1);

    glDrawElements(GL_TRIANGLE_STRIP, 6, GL_UNSIGNED_INT, indices_TRIANGLE_STRIP_1);

    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw()
{
    draw_TRIANGLE_STRIP_1();
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
