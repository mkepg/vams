#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_Group_1 = { 0.3500f, 0.2833f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_TEXT_1 = { -0.2000f, -0.5000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_LINE_STRIP_1 = { -0.6500f, -0.7000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_TRIANGLE_FAN_1 = { 0.2500f, 0.2833f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_QUADS_1 = { -0.4000f, 0.2000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_TRIANGLES_1 = { -0.2500f, -0.2833f, 0.0000f, 1.0000f, 1.0000f };

// --- Buffer Data ---
GLfloat verts_TRIANGLE_FAN_1[] = { -0.1000f, -0.0667f, 0.1000f, -0.0667f, 0.0000f, 0.1333f };
GLfloat colors_TRIANGLE_FAN_1[] = { 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f };
GLfloat verts_QUADS_1[] = { -0.1500f, -0.1500f, 0.1500f, -0.1500f, 0.1500f, 0.1500f, -0.1500f, 0.1500f };
GLfloat colors_QUADS_1[] = { 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f };

// --- VBO Handles ---
GLuint vbo_QUADS_1 = 0;
GLuint cbo_QUADS_1 = 0;

void draw_LINE_STRIP_1();
void draw_TRIANGLE_FAN_1();
void draw_QUADS_1();
void draw_TRIANGLES_1();
void init();

void draw_LINE_STRIP_1()
{
    // LINE_STRIP_1
    glPushMatrix();
    // Transform
    glTranslatef(state_LINE_STRIP_1.x, state_LINE_STRIP_1.y, 0.0f);
    glRotatef(state_LINE_STRIP_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_LINE_STRIP_1.scaleX, state_LINE_STRIP_1.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(1.00f);
    glEnable(GL_LINE_STIPPLE);
    glLineStipple(2, 0x00FF);

    glBegin(GL_LINE_STRIP);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.1500f, -0.1000f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.1500f, 0.1000f);
    glEnd();
    glDisable(GL_LINE_STIPPLE);
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_TRIANGLE_FAN_1()
{
    // TRIANGLE_FAN_1
    glPushMatrix();
    glTranslatef(state_TRIANGLE_FAN_1.x, state_TRIANGLE_FAN_1.y, 0.0f);
    glRotatef(state_TRIANGLE_FAN_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_TRIANGLE_FAN_1.scaleX, state_TRIANGLE_FAN_1.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind client-side arrays
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);
    glVertexPointer(2, GL_FLOAT, 0, verts_TRIANGLE_FAN_1);
    glColorPointer(3, GL_FLOAT, 0, colors_TRIANGLE_FAN_1);

    glDrawArrays(GL_TRIANGLE_FAN, 0, 3);

    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw_QUADS_1()
{
    // QUADS_1
    glPushMatrix();
    glTranslatef(state_QUADS_1.x, state_QUADS_1.y, 0.0f);
    glRotatef(state_QUADS_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_QUADS_1.scaleX, state_QUADS_1.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind GPU buffers
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);

    glBindBuffer(GL_ARRAY_BUFFER, vbo_QUADS_1);
    glVertexPointer(2, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, cbo_QUADS_1);
    glColorPointer(3, GL_FLOAT, 0, 0);

    glDrawArrays(GL_QUADS, 0, 4);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
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
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.2000f, -0.1333f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.2000f, -0.1333f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.0000f, 0.2667f);
    glEnd();
    glPopMatrix();
}

void draw()
{
    draw_QUADS_1();
    draw_LINE_STRIP_1();
    // TEXT_1
    glPushMatrix();
    // Transform
    glTranslatef(state_TEXT_1.x, state_TEXT_1.y, 0.0f);
    glRotatef(state_TEXT_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_TEXT_1.scaleX, state_TEXT_1.scaleY, 1.0f);

    // Text: "Hi"
    glColor3f(1.00f, 1.00f, 1.00f);
    glRasterPos2f(0.0f, 0.0000f);
    {
        const char* textLine = "Hi";
        for (const char* c = textLine; *c != '\0'; c++) {
            glutBitmapCharacter(GLUT_BITMAP_9_BY_15, *c);
        }
    }
    glPopMatrix();
    // Group_1
    glPushMatrix();
    // Transform
    glTranslatef(state_Group_1.x, state_Group_1.y, 0.0f);
    glRotatef(state_Group_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Group_1.scaleX, state_Group_1.scaleY, 1.0f);

    // Children
    draw_TRIANGLES_1();
    draw_TRIANGLE_FAN_1();
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
    // QUADS_1 — upload to GPU
    glGenBuffers(1, &vbo_QUADS_1);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_QUADS_1);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_QUADS_1), verts_QUADS_1, GL_STATIC_DRAW);
    glGenBuffers(1, &cbo_QUADS_1);
    glBindBuffer(GL_ARRAY_BUFFER, cbo_QUADS_1);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_QUADS_1), colors_QUADS_1, GL_STATIC_DRAW);

}

int main(int argc, char** argv)
{
    glutInit(&argc, argv);
    glutInitDisplayMode(GLUT_DOUBLE | GLUT_RGB | GLUT_MULTISAMPLE);
    glutInitWindowSize(800, 600);
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
