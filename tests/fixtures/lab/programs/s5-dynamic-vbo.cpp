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

// --- Buffer Data ---
GLfloat verts_TRIANGLES_1[] = { -0.5000f, -0.3333f, 0.5000f, -0.3333f, 0.0000f, 0.6667f };
GLfloat colors_TRIANGLES_1[] = { 1.00f, 0.00f, 0.00f, 0.00f, 1.00f, 0.00f, 0.00f, 0.00f, 1.00f };

// --- VBO Handles ---
GLuint vbo_TRIANGLES_1 = 0;
GLuint cbo_TRIANGLES_1 = 0;

void draw_TRIANGLES_1();
void update_buffers();
void init();

void draw_TRIANGLES_1()
{
    // TRIANGLES_1
    glPushMatrix();
    glTranslatef(state_TRIANGLES_1.x, state_TRIANGLES_1.y, 0.0f);
    glRotatef(state_TRIANGLES_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_TRIANGLES_1.scaleX, state_TRIANGLES_1.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind GPU buffers
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);

    glBindBuffer(GL_ARRAY_BUFFER, vbo_TRIANGLES_1);
    glVertexPointer(2, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, cbo_TRIANGLES_1);
    glColorPointer(3, GL_FLOAT, 0, 0);

    glDrawArrays(GL_TRIANGLES, 0, 3);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw()
{
    draw_TRIANGLES_1();
}

void update_buffers()
{
    // TRIANGLES_1 — push updated bytes to the GPU (DYNAMIC)
    glBindBuffer(GL_ARRAY_BUFFER, vbo_TRIANGLES_1);
    // Modify verts_TRIANGLES_1[...] above, then push the changed range:
    glBufferSubData(GL_ARRAY_BUFFER, 0, sizeof(verts_TRIANGLES_1), verts_TRIANGLES_1);

    // Unbind, so client-side arrays read from memory again
    glBindBuffer(GL_ARRAY_BUFFER, 0);
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
    // TRIANGLES_1 — upload to GPU
    glGenBuffers(1, &vbo_TRIANGLES_1);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_TRIANGLES_1);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_TRIANGLES_1), verts_TRIANGLES_1, GL_DYNAMIC_DRAW);
    glGenBuffers(1, &cbo_TRIANGLES_1);
    glBindBuffer(GL_ARRAY_BUFFER, cbo_TRIANGLES_1);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_TRIANGLES_1), colors_TRIANGLES_1, GL_DYNAMIC_DRAW);

    // Unbind, so client-side arrays read from memory again
    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

// Internal VAMS wrapper: run per-frame animation and updates
void _vams_idle()
{
    update_buffers();
    glutPostRedisplay();
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
    glutIdleFunc(_vams_idle);

    glutMainLoop();
    return 0;
}
