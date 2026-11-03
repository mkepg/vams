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

ObjectState state_Fox = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Clouds = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Fox = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };

// --- View (the glOrtho bounds, updated by the reshape callback) ---
float viewMinX = -1.6000f, viewMaxX = 1.6000f, viewMinY = -0.9000f, viewMaxY = 0.9000f;

// --- Buffer Data ---
GLfloat verts_Fox[] = { -0.2000f, -0.2000f, 0.2000f, -0.2000f, 0.2000f, 0.2000f, -0.2000f, 0.2000f };
GLfloat colors_Fox[] = { 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f };
GLfloat uvs_Fox[] = { 0.0000f, 0.0000f, 1.0000f, 0.0000f, 1.0000f, 1.0000f, 0.0000f, 1.0000f };
GLfloat verts_Clouds[] = { -1.6000f, -0.9000f, 1.6000f, -0.9000f, 1.6000f, 0.9000f, -1.6000f, 0.9000f };
GLfloat colors_Clouds[] = { 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f };
GLfloat uvs_Clouds[] = { 0.0000f, 0.0000f, 8.0000f, 0.0000f, 8.0000f, 4.5000f, 0.0000f, 4.5000f };

// --- VBO Handles ---
GLuint vbo_Fox = 0;
GLuint cbo_Fox = 0;
GLuint uvbo_Fox = 0;

// --- Texture Handles ---
GLuint tex_Fox = 0;
GLuint tex_Clouds = 0;

void draw_Fox();
void draw_Clouds();
void init();

void draw_Fox()
{
    // Fox
    glPushMatrix();
    glTranslatef(state_Fox.x, state_Fox.y, 0.0f);
    glRotatef(state_Fox.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Fox.scaleX, state_Fox.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind GPU buffers
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);
    glEnableClientState(GL_TEXTURE_COORD_ARRAY);
    glEnable(GL_TEXTURE_2D);
    glBindTexture(GL_TEXTURE_2D, tex_Fox);

    glBindBuffer(GL_ARRAY_BUFFER, vbo_Fox);
    glVertexPointer(2, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, cbo_Fox);
    glColorPointer(3, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, uvbo_Fox);
    glTexCoordPointer(2, GL_FLOAT, 0, 0);

    glDrawArrays(GL_QUADS, 0, 4);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glDisableClientState(GL_TEXTURE_COORD_ARRAY);
    glDisable(GL_TEXTURE_2D);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw_Clouds()
{
    // Clouds
    glPushMatrix();
    glTranslatef(state_Clouds.x, state_Clouds.y, 0.0f);
    glRotatef(state_Clouds.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Clouds.scaleX, state_Clouds.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind client-side arrays
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);
    glEnableClientState(GL_TEXTURE_COORD_ARRAY);
    glEnable(GL_TEXTURE_2D);
    glBindTexture(GL_TEXTURE_2D, tex_Clouds);
    glVertexPointer(2, GL_FLOAT, 0, verts_Clouds);
    glColorPointer(3, GL_FLOAT, 0, colors_Clouds);
    glTexCoordPointer(2, GL_FLOAT, 0, uvs_Clouds);

    glDrawArrays(GL_QUADS, 0, 4);

    glDisableClientState(GL_TEXTURE_COORD_ARRAY);
    glDisable(GL_TEXTURE_2D);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw()
{
    draw_Clouds();
    draw_Fox();
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);

    // 2D orthographic projection — see glOrtho editor in VAMS
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(viewMinX, viewMaxX, viewMinY, viewMaxY, -1.0, 1.0);

    // Switch to the modelview stack for object transforms
    glMatrixMode(GL_MODELVIEW);
    glLoadIdentity();

    draw();
    glutSwapBuffers();
}

// Keyboard callback: glutKeyboardFunc
void onKey(unsigned char key, int x, int y)
{
    switch (key) {
    case ' ':
        state_Fox = initial_Fox;
        break;
    }
    glutPostRedisplay();
}

// Special keys callback: glutSpecialFunc
void onSpecial(int key, int x, int y)
{
    switch (key) {
    case GLUT_KEY_UP:
        state_Fox.x += 0.00f;
        state_Fox.y += 0.05f;
        break;
    case GLUT_KEY_DOWN:
        state_Fox.x += 0.00f;
        state_Fox.y += -0.05f;
        break;
    case GLUT_KEY_LEFT:
        state_Fox.x += -0.05f;
        state_Fox.y += 0.00f;
        break;
    case GLUT_KEY_RIGHT:
        state_Fox.x += 0.05f;
        state_Fox.y += 0.00f;
        break;
    }
    glutPostRedisplay();
}

// Reshape callback: glutReshapeFunc
void onReshape(int width, int height)
{
    // Keep proportions: widen the viewing volume to match the window's shape
    glViewport(0, 0, width, height);
    float aspect = (float)width / (float)(height > 0 ? height : 1);
    float cx = 0.0000f, cy = 0.0000f;
    float halfW = 1.6000f, halfH = 0.9000f;
    if (aspect >= halfW / halfH) halfW = halfH * aspect;
    else halfH = halfW / aspect;
    viewMinX = cx - halfW;
    viewMaxX = cx + halfW;
    viewMinY = cy - halfH;
    viewMaxY = cy + halfH;
    glutPostRedisplay();
}

// One-time setup, called once before the main loop
void init()
{
    // Fox — upload to GPU
    glGenBuffers(1, &vbo_Fox);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_Fox);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_Fox), verts_Fox, GL_STATIC_DRAW);
    glGenBuffers(1, &cbo_Fox);
    glBindBuffer(GL_ARRAY_BUFFER, cbo_Fox);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_Fox), colors_Fox, GL_STATIC_DRAW);
    glGenBuffers(1, &uvbo_Fox);
    glBindBuffer(GL_ARRAY_BUFFER, uvbo_Fox);
    glBufferData(GL_ARRAY_BUFFER, sizeof(uvs_Fox), uvs_Fox, GL_STATIC_DRAW);

    // Unbind, so client-side arrays read from memory again
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    // --- Texture setup ---
    glTexEnvi(GL_TEXTURE_ENV, GL_TEXTURE_ENV_MODE, GL_REPLACE);

    // OpenGL expects the 0.0 Y-coordinate to be at the bottom, but images store it at the top
    stbi_set_flip_vertically_on_load(true);

    // Fox — texture object
    glGenTextures(1, &tex_Fox);
    glBindTexture(GL_TEXTURE_2D, tex_Fox);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    {
        int width, height, channels;
        unsigned char* data = stbi_load("Pixel fox.png", &width, &height, &channels, 4);
        if (data) {
            glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, data);
            stbi_image_free(data);
        }
    }

    // Clouds — texture object
    glGenTextures(1, &tex_Clouds);
    glBindTexture(GL_TEXTURE_2D, tex_Clouds);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);
    {
        int width, height, channels;
        unsigned char* data = stbi_load("Cloud tile.png", &width, &height, &channels, 4);
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

    glClearColor(0.47f, 0.78f, 0.92f, 1.0f);

    init();

    glutDisplayFunc(display);
    glutKeyboardFunc(onKey);
    glutSpecialFunc(onSpecial);
    glutReshapeFunc(onReshape);

    glutMainLoop();
    return 0;
}
