#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// stb_image: define its implementation in exactly one file, before including it
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_QUADS_1 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };

// --- Texture Handles ---
GLuint tex_QUADS_1 = 0;

void draw_QUADS_1();
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
    glEnable(GL_TEXTURE_2D);
    glBindTexture(GL_TEXTURE_2D, tex_QUADS_1);

    glBegin(GL_QUADS);
        glColor3f(1.00f, 1.00f, 1.00f);
        glTexCoord2f(0.0000f, 0.0000f);
        glVertex2f(-0.5000f, -0.5000f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glTexCoord2f(1.0000f, 0.0000f);
        glVertex2f(0.5000f, -0.5000f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glTexCoord2f(1.0000f, 1.0000f);
        glVertex2f(0.5000f, 0.5000f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glTexCoord2f(0.0000f, 1.0000f);
        glVertex2f(-0.5000f, 0.5000f);
    glEnd();
    glDisable(GL_TEXTURE_2D);
    glPopMatrix();
}

void draw()
{
    draw_QUADS_1();
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
    // --- Texture setup ---
    glTexEnvi(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_REPLACE);

    // OpenGL expects the 0.0 Y-coordinate to be at the bottom, but images store it at the top
    stbi_set_flip_vertically_on_load(true);

    // QUADS_1 — texture object
    glGenTextures(1, &tex_QUADS_1);
    glBindTexture(GL_TEXTURE_2D, tex_QUADS_1);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    {
        int width, height, channels;
        unsigned char* data = stbi_load("checkerboard.png", &width, &height, &channels, 4);
        if (data) {
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
            stbi_image_free(data);
        }
    }
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
