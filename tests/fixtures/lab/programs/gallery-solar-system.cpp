#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_Moon = { 0.1100f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Moon_orbit = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Moon_path = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Earth_body = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Earth = { 0.5000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Earth_orbit = { 0.0000f, 0.0000f, 30.0000f, 1.0000f, 1.0000f };
ObjectState state_Mars = { 0.8000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Mars_orbit = { 0.0000f, 0.0000f, 140.0000f, 1.0000f, 1.0000f };
ObjectState state_Sun = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Mars_path = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Earth_path = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Stars = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Moon_orbit = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Earth_orbit = { 0.0000f, 0.0000f, 30.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Mars_orbit = { 0.0000f, 0.0000f, 140.0000f, 1.0000f, 1.0000f };

// --- Buffer Data ---
GLfloat verts_Stars[] = { -0.0307f, 0.1094f, -1.2305f, -0.4608f, -0.1817f, 0.0115f, -1.3486f, 0.6820f, 0.2861f, -0.1605f, -0.6898f, 0.5063f, 0.5038f, -0.7622f, -0.0046f, -0.4769f, 0.5503f, -0.6156f, 0.1933f, -0.0229f, -1.0362f, -0.8099f, 1.4052f, 0.8458f, -1.2136f, -0.1004f, 1.4582f, -0.5595f, -0.2584f, 0.0906f, 0.5500f, -0.3945f, -1.0548f, 0.8741f, -0.1739f, -0.4813f, 0.1506f, -0.3053f, -1.1085f, 0.4911f, -0.4746f, -0.2699f, -1.3452f, 0.7672f, -0.8363f, 0.6914f, -0.0937f, -0.4751f, 0.3295f, -0.1769f, 0.8284f, 0.2751f, -1.1648f, -0.4970f, -0.1588f, -0.7377f, -1.4475f, -0.1579f, 0.5790f, 0.2644f, 1.4566f, -0.3151f, -0.1976f, -0.0076f, -0.1957f, 0.6092f, -0.1577f, -0.1092f, -0.7550f, -0.4739f, 0.7777f, -0.6627f, -0.7349f, 0.4800f, 1.1468f, 0.8430f, 1.3659f, 0.6487f, 0.7916f, 0.2525f, 0.1745f, -0.8566f, -0.5644f, -0.2565f, -0.9115f, -0.1916f, 0.5949f, 0.4270f, -0.7465f, 0.8216f, -1.5776f, -0.2524f, 0.2745f, -0.1060f, -1.3138f, 0.8830f };
GLfloat colors_Stars[] = { 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 0.62f, 0.71f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f, 1.00f };

// --- VBO Handles ---
GLuint vbo_Stars = 0;
GLuint cbo_Stars = 0;

void draw_Moon();
void draw_Moon_path();
void draw_Earth_body();
void draw_Mars();
void draw_Sun();
void draw_Mars_path();
void draw_Earth_path();
void draw_Stars();
void init();

void draw_Moon()
{
    // Moon
    glPushMatrix();
    // Transform
    glTranslatef(state_Moon.x, state_Moon.y, 0.0f);
    glRotatef(state_Moon.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Moon.scaleX, state_Moon.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(0.0220f, 0.0000f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(0.0191f, 0.0110f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(0.0110f, 0.0191f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(0.0000f, 0.0220f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(-0.0110f, 0.0191f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(-0.0191f, 0.0110f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(-0.0220f, 0.0000f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(-0.0191f, -0.0110f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(-0.0110f, -0.0191f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(0.0000f, -0.0220f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(0.0110f, -0.0191f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(0.0191f, -0.0110f);
        glColor3f(0.73f, 0.74f, 0.78f);
        glVertex2f(0.0220f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Moon_path()
{
    // Moon path
    glPushMatrix();
    // Transform
    glTranslatef(state_Moon_path.x, state_Moon_path.y, 0.0f);
    glRotatef(state_Moon_path.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Moon_path.scaleX, state_Moon_path.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(1.00f);
    glEnable(GL_LINE_STIPPLE);
    glLineStipple(2, 0x0F0F);

    glBegin(GL_LINE_LOOP);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1100f, 0.0000f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1095f, 0.0108f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1079f, 0.0215f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1053f, 0.0319f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1016f, 0.0421f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0970f, 0.0519f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0915f, 0.0611f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0850f, 0.0698f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0778f, 0.0778f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0698f, 0.0850f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0611f, 0.0915f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0519f, 0.0970f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0421f, 0.1016f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0319f, 0.1053f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0215f, 0.1079f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0108f, 0.1095f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0000f, 0.1100f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0108f, 0.1095f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0215f, 0.1079f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0319f, 0.1053f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0421f, 0.1016f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0519f, 0.0970f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0611f, 0.0915f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0698f, 0.0850f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0778f, 0.0778f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0850f, 0.0698f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0915f, 0.0611f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0970f, 0.0519f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1016f, 0.0421f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1053f, 0.0319f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1079f, 0.0215f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1095f, 0.0108f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1100f, 0.0000f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1095f, -0.0108f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1079f, -0.0215f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1053f, -0.0319f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1016f, -0.0421f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0970f, -0.0519f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0915f, -0.0611f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0850f, -0.0698f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0778f, -0.0778f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0698f, -0.0850f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0611f, -0.0915f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0519f, -0.0970f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0421f, -0.1016f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0319f, -0.1053f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0215f, -0.1079f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0108f, -0.1095f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0000f, -0.1100f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0108f, -0.1095f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0215f, -0.1079f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0319f, -0.1053f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0421f, -0.1016f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0519f, -0.0970f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0611f, -0.0915f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0698f, -0.0850f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0778f, -0.0778f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0850f, -0.0698f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0915f, -0.0611f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0970f, -0.0519f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1016f, -0.0421f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1053f, -0.0319f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1079f, -0.0215f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1095f, -0.0108f);
    glEnd();
    glDisable(GL_LINE_STIPPLE);
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Earth_body()
{
    // Earth body
    glPushMatrix();
    // Transform
    glTranslatef(state_Earth_body.x, state_Earth_body.y, 0.0f);
    glRotatef(state_Earth_body.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Earth_body.scaleX, state_Earth_body.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.56f, 0.82f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0600f, 0.0000f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0571f, 0.0185f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0485f, 0.0353f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0353f, 0.0485f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0185f, 0.0571f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0000f, 0.0600f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(-0.0185f, 0.0571f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(-0.0353f, 0.0485f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(-0.0485f, 0.0353f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(-0.0571f, 0.0185f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(-0.0600f, 0.0000f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(-0.0571f, -0.0185f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(-0.0485f, -0.0353f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(-0.0353f, -0.0485f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(-0.0185f, -0.0571f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0000f, -0.0600f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0185f, -0.0571f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0353f, -0.0485f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0485f, -0.0353f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0571f, -0.0185f);
        glColor3f(0.16f, 0.44f, 0.82f);
        glVertex2f(0.0600f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Mars()
{
    // Mars
    glPushMatrix();
    // Transform
    glTranslatef(state_Mars.x, state_Mars.y, 0.0f);
    glRotatef(state_Mars.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Mars.scaleX, state_Mars.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.95f, 0.60f, 0.43f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(0.0450f, 0.0000f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(0.0416f, 0.0172f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(0.0318f, 0.0318f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(0.0172f, 0.0416f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(0.0000f, 0.0450f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(-0.0172f, 0.0416f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(-0.0318f, 0.0318f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(-0.0416f, 0.0172f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(-0.0450f, 0.0000f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(-0.0416f, -0.0172f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(-0.0318f, -0.0318f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(-0.0172f, -0.0416f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(0.0000f, -0.0450f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(0.0172f, -0.0416f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(0.0318f, -0.0318f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(0.0416f, -0.0172f);
        glColor3f(0.72f, 0.27f, 0.16f);
        glVertex2f(0.0450f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Sun()
{
    // Sun
    glPushMatrix();
    // Transform
    glTranslatef(state_Sun.x, state_Sun.y, 0.0f);
    glRotatef(state_Sun.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Sun.scaleX, state_Sun.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 0.95f, 0.69f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.1600f, 0.0000f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.1545f, 0.0414f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.1386f, 0.0800f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.1131f, 0.1131f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.0800f, 0.1386f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.0414f, 0.1545f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.0000f, 0.1600f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.0414f, 0.1545f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.0800f, 0.1386f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.1131f, 0.1131f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.1386f, 0.0800f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.1545f, 0.0414f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.1600f, 0.0000f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.1545f, -0.0414f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.1386f, -0.0800f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.1131f, -0.1131f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.0800f, -0.1386f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(-0.0414f, -0.1545f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.0000f, -0.1600f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.0414f, -0.1545f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.0800f, -0.1386f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.1131f, -0.1131f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.1386f, -0.0800f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.1545f, -0.0414f);
        glColor3f(1.00f, 0.62f, 0.10f);
        glVertex2f(0.1600f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Mars_path()
{
    // Mars path
    glPushMatrix();
    // Transform
    glTranslatef(state_Mars_path.x, state_Mars_path.y, 0.0f);
    glRotatef(state_Mars_path.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Mars_path.scaleX, state_Mars_path.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(1.00f);
    glEnable(GL_LINE_STIPPLE);
    glLineStipple(2, 0x0F0F);

    glBegin(GL_LINE_LOOP);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.8000f, 0.0000f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.7961f, 0.0784f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.7846f, 0.1561f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.7656f, 0.2322f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.7391f, 0.3061f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.7055f, 0.3771f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.6652f, 0.4445f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.6184f, 0.5075f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.5657f, 0.5657f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.5075f, 0.6184f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4445f, 0.6652f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.3771f, 0.7055f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.3061f, 0.7391f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.2322f, 0.7656f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1561f, 0.7846f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0784f, 0.7961f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0000f, 0.8000f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0784f, 0.7961f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1561f, 0.7846f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.2322f, 0.7656f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.3061f, 0.7391f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.3771f, 0.7055f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4445f, 0.6652f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.5075f, 0.6184f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.5657f, 0.5657f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.6184f, 0.5075f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.6652f, 0.4445f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.7055f, 0.3771f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.7391f, 0.3061f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.7656f, 0.2322f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.7846f, 0.1561f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.7961f, 0.0784f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.8000f, 0.0000f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.7961f, -0.0784f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.7846f, -0.1561f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.7656f, -0.2322f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.7391f, -0.3061f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.7055f, -0.3771f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.6652f, -0.4445f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.6184f, -0.5075f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.5657f, -0.5657f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.5075f, -0.6184f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4445f, -0.6652f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.3771f, -0.7055f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.3061f, -0.7391f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.2322f, -0.7656f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1561f, -0.7846f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0784f, -0.7961f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0000f, -0.8000f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0784f, -0.7961f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1561f, -0.7846f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.2322f, -0.7656f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.3061f, -0.7391f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.3771f, -0.7055f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4445f, -0.6652f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.5075f, -0.6184f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.5657f, -0.5657f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.6184f, -0.5075f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.6652f, -0.4445f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.7055f, -0.3771f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.7391f, -0.3061f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.7656f, -0.2322f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.7846f, -0.1561f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.7961f, -0.0784f);
    glEnd();
    glDisable(GL_LINE_STIPPLE);
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Earth_path()
{
    // Earth path
    glPushMatrix();
    // Transform
    glTranslatef(state_Earth_path.x, state_Earth_path.y, 0.0f);
    glRotatef(state_Earth_path.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Earth_path.scaleX, state_Earth_path.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(1.00f);
    glEnable(GL_LINE_STIPPLE);
    glLineStipple(2, 0x0F0F);

    glBegin(GL_LINE_LOOP);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.5000f, 0.0000f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4976f, 0.0490f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4904f, 0.0975f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4785f, 0.1451f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4619f, 0.1913f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4410f, 0.2357f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4157f, 0.2778f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.3865f, 0.3172f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.3536f, 0.3536f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.3172f, 0.3865f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.2778f, 0.4157f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.2357f, 0.4410f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1913f, 0.4619f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1451f, 0.4785f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0975f, 0.4904f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0490f, 0.4976f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0000f, 0.5000f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0490f, 0.4976f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0975f, 0.4904f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1451f, 0.4785f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1913f, 0.4619f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.2357f, 0.4410f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.2778f, 0.4157f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.3172f, 0.3865f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.3536f, 0.3536f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.3865f, 0.3172f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4157f, 0.2778f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4410f, 0.2357f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4619f, 0.1913f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4785f, 0.1451f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4904f, 0.0975f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4976f, 0.0490f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.5000f, 0.0000f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4976f, -0.0490f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4904f, -0.0975f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4785f, -0.1451f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4619f, -0.1913f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4410f, -0.2357f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.4157f, -0.2778f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.3865f, -0.3172f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.3536f, -0.3536f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.3172f, -0.3865f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.2778f, -0.4157f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.2357f, -0.4410f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1913f, -0.4619f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.1451f, -0.4785f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0975f, -0.4904f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(-0.0490f, -0.4976f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0000f, -0.5000f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0490f, -0.4976f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.0975f, -0.4904f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1451f, -0.4785f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.1913f, -0.4619f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.2357f, -0.4410f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.2778f, -0.4157f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.3172f, -0.3865f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.3536f, -0.3536f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.3865f, -0.3172f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4157f, -0.2778f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4410f, -0.2357f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4619f, -0.1913f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4785f, -0.1451f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4904f, -0.0975f);
        glColor3f(0.24f, 0.29f, 0.48f);
        glVertex2f(0.4976f, -0.0490f);
    glEnd();
    glDisable(GL_LINE_STIPPLE);
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Stars()
{
    // Stars
    glPushMatrix();
    glTranslatef(state_Stars.x, state_Stars.y, 0.0f);
    glRotatef(state_Stars.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Stars.scaleX, state_Stars.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);
    // Adjust visible point size — default is 1px
    glPointSize(8.0f);

    // Bind GPU buffers
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);

    glBindBuffer(GL_ARRAY_BUFFER, vbo_Stars);
    glVertexPointer(2, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, cbo_Stars);
    glColorPointer(3, GL_FLOAT, 0, 0);

    glDrawArrays(GL_POINTS, 0, 48);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPointSize(1.0f); // Reset
    glPopMatrix();
}

void draw()
{
    draw_Stars();
    draw_Earth_path();
    draw_Mars_path();
    draw_Sun();
    // Mars orbit
    glPushMatrix();
    // Transform
    glTranslatef(state_Mars_orbit.x, state_Mars_orbit.y, 0.0f);
    glRotatef(state_Mars_orbit.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Mars_orbit.scaleX, state_Mars_orbit.scaleY, 1.0f);

    // Children
    draw_Mars();
    glPopMatrix();
    // Earth orbit
    glPushMatrix();
    // Transform
    glTranslatef(state_Earth_orbit.x, state_Earth_orbit.y, 0.0f);
    glRotatef(state_Earth_orbit.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Earth_orbit.scaleX, state_Earth_orbit.scaleY, 1.0f);

    // Children
        // Earth
        glPushMatrix();
        // Transform
        glTranslatef(state_Earth.x, state_Earth.y, 0.0f);
        glRotatef(state_Earth.rotation, 0.0f, 0.0f, 1.0f);
        glScalef(state_Earth.scaleX, state_Earth.scaleY, 1.0f);

        // Children
        draw_Earth_body();
        draw_Moon_path();
            // Moon orbit
            glPushMatrix();
            // Transform
            glTranslatef(state_Moon_orbit.x, state_Moon_orbit.y, 0.0f);
            glRotatef(state_Moon_orbit.rotation, 0.0f, 0.0f, 1.0f);
            glScalef(state_Moon_orbit.scaleX, state_Moon_orbit.scaleY, 1.0f);

            // Children
            draw_Moon();
            glPopMatrix();
        glPopMatrix();
    glPopMatrix();
}

void display()
{
    glClear(GL_COLOR_BUFFER_BIT);

    // 2D orthographic projection — see glOrtho editor in VAMS
    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    glOrtho(-1.6000, 1.6000, -0.9000, 0.9000, -1.0, 1.0);

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
        state_Earth_orbit = initial_Earth_orbit;
        state_Mars_orbit = initial_Mars_orbit;
        state_Moon_orbit = initial_Moon_orbit;
        break;
    }
    glutPostRedisplay();
}

// Idle callback: glutIdleFunc
void onIdle()
{
    state_Earth_orbit.rotation += 2.00f;
    state_Mars_orbit.rotation += 1.00f;
    state_Moon_orbit.rotation += 8.00f;
    glutPostRedisplay();
}

// One-time setup, called once before the main loop
void init()
{
    // Stars — upload to GPU
    glGenBuffers(1, &vbo_Stars);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_Stars);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_Stars), verts_Stars, GL_STATIC_DRAW);
    glGenBuffers(1, &cbo_Stars);
    glBindBuffer(GL_ARRAY_BUFFER, cbo_Stars);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_Stars), colors_Stars, GL_STATIC_DRAW);

    // Unbind, so client-side arrays read from memory again
    glBindBuffer(GL_ARRAY_BUFFER, 0);
}

// Internal VAMS wrapper: run per-frame animation and updates
void _vams_idle()
{
    onIdle();
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

    glClearColor(0.02f, 0.03f, 0.10f, 1.0f);

    init();

    glutDisplayFunc(display);
    glutKeyboardFunc(onKey);
    glutIdleFunc(_vams_idle);

    glutMainLoop();
    return 0;
}
