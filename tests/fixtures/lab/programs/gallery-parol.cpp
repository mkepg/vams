#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
    float r, g, b;
    bool useColor;
    bool visible;
};

ObjectState state_Outline = { 0.0000f, 0.1200f, 0.0000f, 1.0000f, 1.0000f, 0.0f, 0.0f, 0.0f, false, true };
ObjectState state_Inner_ring = { 0.0000f, 0.1200f, 0.0000f, 1.0000f, 1.0000f, 0.0f, 0.0f, 0.0f, false, true };
ObjectState state_Star = { 0.0000f, 0.1200f, 0.0000f, 1.0000f, 1.0000f, 0.0f, 0.0f, 0.0f, false, true };
ObjectState state_Tails = { 0.0000f, 0.1200f, 0.0000f, 1.0000f, 1.0000f, 0.0f, 0.0f, 0.0f, false, true };
ObjectState state_String = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f, 0.0f, 0.0f, 0.0f, false, true };
ObjectState state_Glow = { 0.0000f, 0.1200f, 0.0000f, 1.0000f, 1.0000f, 0.0f, 0.0f, 0.0f, false, true };
ObjectState state_Night_sky = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f, 0.0f, 0.0f, 0.0f, false, true };

void draw_Outline();
void draw_Inner_ring();
void draw_Star();
void draw_Tails();
void draw_String();
void draw_Glow();
void draw_Night_sky();
void init();

void draw_Outline()
{
    // Outline
    glPushMatrix();
    // Transform
    glTranslatef(state_Outline.x, state_Outline.y, 0.0f);
    glRotatef(state_Outline.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Outline.scaleX, state_Outline.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(3.00f);

    glBegin(GL_LINE_LOOP);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(0.0000f, 0.4000f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(-0.1058f, 0.1456f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(-0.3804f, 0.1236f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(-0.1712f, -0.0556f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(-0.2351f, -0.3236f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(0.0000f, -0.1800f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(0.2351f, -0.3236f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(0.1712f, -0.0556f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(0.3804f, 0.1236f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(0.1058f, 0.1456f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Inner_ring()
{
    // Inner ring
    glPushMatrix();
    // Transform
    glTranslatef(state_Inner_ring.x, state_Inner_ring.y, 0.0f);
    glRotatef(state_Inner_ring.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Inner_ring.scaleX, state_Inner_ring.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(2.00f);

    glBegin(GL_LINE_LOOP);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.1000f, 0.0000f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0966f, 0.0259f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0866f, 0.0500f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0707f, 0.0707f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0500f, 0.0866f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0259f, 0.0966f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0000f, 0.1000f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.0259f, 0.0966f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.0500f, 0.0866f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.0707f, 0.0707f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.0866f, 0.0500f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.0966f, 0.0259f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.1000f, 0.0000f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.0966f, -0.0259f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.0866f, -0.0500f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.0707f, -0.0707f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.0500f, -0.0866f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(-0.0259f, -0.0966f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0000f, -0.1000f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0259f, -0.0966f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0500f, -0.0866f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0707f, -0.0707f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0866f, -0.0500f);
        glColor3f(1.00f, 0.97f, 0.88f);
        glVertex2f(0.0966f, -0.0259f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Star()
{
    // Star
    glPushMatrix();
    // Transform
    glTranslatef(state_Star.x, state_Star.y, 0.0f);
    glRotatef(state_Star.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Star.scaleX, state_Star.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    if (state_Star.useColor) glColor3f(state_Star.r, state_Star.g, state_Star.b);
    glBegin(GL_TRIANGLE_FAN);
        if (!state_Star.useColor) glColor3f(1.00f, 0.95f, 0.81f);
        glVertex2f(0.0000f, 0.0000f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.0000f, 0.4000f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(-0.1058f, 0.1456f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(-0.3804f, 0.1236f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(-0.1712f, -0.0556f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(-0.2351f, -0.3236f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.0000f, -0.1800f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.2351f, -0.3236f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.1712f, -0.0556f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.3804f, 0.1236f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.1058f, 0.1456f);
        if (!state_Star.useColor) glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.0000f, 0.4000f);
    glEnd();
    glPopMatrix();
}

void draw_Tails()
{
    // Tails
    glPushMatrix();
    // Transform
    glTranslatef(state_Tails.x, state_Tails.y, 0.0f);
    glRotatef(state_Tails.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Tails.scaleX, state_Tails.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(3.00f);

    glBegin(GL_LINES);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(-0.2351f, -0.3236f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(-0.2851f, -0.7436f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(-0.2051f, -0.3236f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(-0.2451f, -0.6836f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.2351f, -0.3236f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(0.2851f, -0.7436f);
        glColor3f(1.00f, 0.79f, 0.29f);
        glVertex2f(0.2051f, -0.3236f);
        glColor3f(1.00f, 0.48f, 0.24f);
        glVertex2f(0.2451f, -0.6836f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_String()
{
    // String
    glPushMatrix();
    // Transform
    glTranslatef(state_String.x, state_String.y, 0.0f);
    glRotatef(state_String.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_String.scaleX, state_String.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(2.00f);

    glBegin(GL_LINES);
        glColor3f(0.55f, 0.52f, 0.68f);
        glVertex2f(0.0000f, 0.9000f);
        glColor3f(0.55f, 0.52f, 0.68f);
        glVertex2f(0.0000f, 0.5200f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Glow()
{
    // Glow
    glPushMatrix();
    // Transform
    glTranslatef(state_Glow.x, state_Glow.y, 0.0f);
    glRotatef(state_Glow.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Glow.scaleX, state_Glow.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(0.37f, 0.29f, 0.17f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.7000f, 0.0000f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.6914f, 0.1095f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.6657f, 0.2163f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.6237f, 0.3178f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.5663f, 0.4114f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.4950f, 0.4950f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.4114f, 0.5663f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.3178f, 0.6237f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.2163f, 0.6657f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.1095f, 0.6914f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.0000f, 0.7000f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.1095f, 0.6914f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.2163f, 0.6657f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.3178f, 0.6237f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.4114f, 0.5663f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.4950f, 0.4950f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.5663f, 0.4114f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.6237f, 0.3178f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.6657f, 0.2163f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.6914f, 0.1095f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.7000f, 0.0000f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.6914f, -0.1095f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.6657f, -0.2163f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.6237f, -0.3178f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.5663f, -0.4114f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.4950f, -0.4950f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.4114f, -0.5663f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.3178f, -0.6237f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.2163f, -0.6657f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(-0.1095f, -0.6914f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.0000f, -0.7000f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.1095f, -0.6914f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.2163f, -0.6657f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.3178f, -0.6237f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.4114f, -0.5663f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.4950f, -0.4950f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.5663f, -0.4114f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.6237f, -0.3178f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.6657f, -0.2163f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.6914f, -0.1095f);
        glColor3f(0.05f, 0.07f, 0.21f);
        glVertex2f(0.7000f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Night_sky()
{
    // Night sky
    glPushMatrix();
    // Transform
    glTranslatef(state_Night_sky.x, state_Night_sky.y, 0.0f);
    glRotatef(state_Night_sky.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Night_sky.scaleX, state_Night_sky.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    // Adjust visible point size — default is 1px
    glPointSize(8.0f);

    glBegin(GL_POINTS);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(0.4797f, 0.7280f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.6477f, -0.7127f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.8697f, 0.4671f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(-0.9765f, -0.3106f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.9677f, -0.2901f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.3802f, 0.6174f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(1.4487f, 0.0342f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.6466f, -0.0842f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.1772f, 0.1511f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(-0.7779f, 0.5623f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-1.2238f, 0.5050f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-1.4754f, -0.3320f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(-0.1896f, 0.0737f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.3027f, 0.2775f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.7523f, -0.2316f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(1.0801f, -0.8315f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-1.4004f, -0.1666f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(1.1726f, -0.7480f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(0.8979f, 0.2466f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(1.1335f, -0.2274f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.8522f, 0.5190f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(0.3306f, 0.3080f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.6289f, 0.6952f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.8578f, 0.5693f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(0.4448f, -0.0472f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.7791f, -0.3990f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.9441f, 0.0030f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(-0.8929f, -0.2191f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0241f, 0.6903f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.2868f, -0.5800f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(0.5842f, 0.3923f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(1.3729f, -0.8372f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.6965f, -0.5797f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(-0.4572f, 0.5871f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.5080f, -0.7813f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-0.1276f, 0.6040f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(0.2495f, -0.8348f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(-1.3519f, -0.3421f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(1.5075f, -0.0290f);
        glColor3f(0.79f, 0.83f, 1.00f);
        glVertex2f(0.5711f, 0.3266f);
    glEnd();
    glPointSize(1.0f); // Reset
    glPopMatrix();
}

void draw()
{
    draw_Night_sky();
    if (state_Glow.visible) draw_Glow();
    draw_String();
    draw_Tails();
    draw_Star();
    draw_Inner_ring();
    draw_Outline();
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
    case '1':
        state_Star.r = 1.00f;
        state_Star.g = 0.35f;
        state_Star.b = 0.37f;
        state_Star.useColor = true;
        break;
    case '2':
        state_Star.r = 1.00f;
        state_Star.g = 0.79f;
        state_Star.b = 0.29f;
        state_Star.useColor = true;
        break;
    case '3':
        state_Star.r = 0.22f;
        state_Star.g = 0.78f;
        state_Star.b = 0.75f;
        state_Star.useColor = true;
        break;
    }
    glutPostRedisplay();
}

// Mouse callback: glutMouseFunc
void onMouse(int button, int state, int x, int y)
{
    if (button == GLUT_LEFT_BUTTON && state == GLUT_DOWN) {
        state_Glow.visible = !state_Glow.visible;
    }
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

    glClearColor(0.05f, 0.07f, 0.21f, 1.0f);

    init();

    glutDisplayFunc(display);
    glutKeyboardFunc(onKey);
    glutMouseFunc(onMouse);

    glutMainLoop();
    return 0;
}
