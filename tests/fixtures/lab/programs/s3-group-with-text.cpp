#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_Group_2 = { -0.0875f, 0.3000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_TEXT_1 = { -0.1125f, 0.3000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Group_1 = { 0.1125f, -0.3000f, 45.0000f, 1.0000f, 1.0000f };
ObjectState state_QUADS_1 = { 0.2750f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_TRIANGLES_1 = { -0.2750f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };

void draw_QUADS_1();
void draw_TRIANGLES_1();
void init();

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
        glColor3f(0.20f, 0.40f, 1.00f);
        glVertex2f(-0.2000f, -0.2000f);
        glColor3f(0.20f, 0.40f, 1.00f);
        glVertex2f(0.2000f, -0.2000f);
        glColor3f(0.20f, 0.40f, 1.00f);
        glVertex2f(0.2000f, 0.2000f);
        glColor3f(0.20f, 0.40f, 1.00f);
        glVertex2f(-0.2000f, 0.2000f);
    glEnd();
    glPopMatrix();
}

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
        glColor3f(1.00f, 0.53f, 0.00f);
        glVertex2f(-0.2500f, -0.1667f);
        glColor3f(1.00f, 0.53f, 0.00f);
        glVertex2f(0.2500f, -0.1667f);
        glColor3f(1.00f, 0.53f, 0.00f);
        glVertex2f(0.0000f, 0.3333f);
    glEnd();
    glPopMatrix();
}

void draw()
{
    // Group_2
    glPushMatrix();
    // Transform
    glTranslatef(state_Group_2.x, state_Group_2.y, 0.0f);
    glRotatef(state_Group_2.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Group_2.scaleX, state_Group_2.scaleY, 1.0f);

    // Children
        // Group_1
        glPushMatrix();
        // Transform
        glTranslatef(state_Group_1.x, state_Group_1.y, 0.0f);
        glRotatef(state_Group_1.rotation, 0.0f, 0.0f, 1.0f);
        glScalef(state_Group_1.scaleX, state_Group_1.scaleY, 1.0f);

        // Children
        draw_TRIANGLES_1();
        draw_QUADS_1();
        glPopMatrix();
        // TEXT_1
        glPushMatrix();
        // Transform
        glTranslatef(state_TEXT_1.x, state_TEXT_1.y, 0.0f);
        glRotatef(state_TEXT_1.rotation, 0.0f, 0.0f, 1.0f);
        glScalef(state_TEXT_1.scaleX, state_TEXT_1.scaleY, 1.0f);

        // Text: "Hello"
        glColor3f(1.00f, 1.00f, 1.00f);
        glRasterPos2f(0.0f, 0.0000f);
        {
            const char* textLine = "Hello";
            for (const char* c = textLine; *c != '\0'; c++) {
                glutBitmapCharacter(GLUT_BITMAP_9_BY_15, *c);
            }
        }
        glPopMatrix();
    glPopMatrix();
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
