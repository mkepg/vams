#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_Big_pinwheel_pin = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Big_pinwheel_vanes = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Big_pinwheel = { -0.8500f, 0.1200f, 15.0000f, 1.0000f, 1.0000f };
ObjectState state_Big_pinwheel_stick = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Middle_pinwheel_pin = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Middle_pinwheel_vanes = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Middle_pinwheel = { 0.2500f, 0.2600f, 15.0000f, 1.0000f, 1.0000f };
ObjectState state_Middle_pinwheel_stick = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Small_pinwheel_pin = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Small_pinwheel_vanes = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Small_pinwheel = { 1.0500f, 0.0200f, 15.0000f, 1.0000f, 1.0000f };
ObjectState state_Small_pinwheel_stick = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Hill = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Cloud_1 = { 0.7000f, 0.6600f, 0.0000f, 2.2000f, 1.0000f };
ObjectState state_Cloud_2 = { -0.2500f, 0.7400f, 0.0000f, 2.2000f, 1.0000f };
ObjectState state_Sun = { -1.2800f, 0.6400f, 0.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Big_pinwheel = { -0.8500f, 0.1200f, 15.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Middle_pinwheel = { 0.2500f, 0.2600f, 15.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Small_pinwheel = { 1.0500f, 0.0200f, 15.0000f, 1.0000f, 1.0000f };

void draw_Big_pinwheel_pin();
void draw_Big_pinwheel_vanes();
void draw_Big_pinwheel_stick();
void draw_Middle_pinwheel_pin();
void draw_Middle_pinwheel_vanes();
void draw_Middle_pinwheel_stick();
void draw_Small_pinwheel_pin();
void draw_Small_pinwheel_vanes();
void draw_Small_pinwheel_stick();
void draw_Hill();
void draw_Cloud_1();
void draw_Cloud_2();
void draw_Sun();
void init();

void draw_Big_pinwheel_pin()
{
    // Big pinwheel pin
    glPushMatrix();
    // Transform
    glTranslatef(state_Big_pinwheel_pin.x, state_Big_pinwheel_pin.y, 0.0f);
    glRotatef(state_Big_pinwheel_pin.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Big_pinwheel_pin.scaleX, state_Big_pinwheel_pin.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0408f, 0.0000f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0353f, 0.0204f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0204f, 0.0353f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0000f, 0.0408f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0204f, 0.0353f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0353f, 0.0204f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0408f, 0.0000f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0353f, -0.0204f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0204f, -0.0353f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0000f, -0.0408f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0204f, -0.0353f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0353f, -0.0204f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0408f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Big_pinwheel_vanes()
{
    // Big pinwheel vanes
    glPushMatrix();
    // Transform
    glTranslatef(state_Big_pinwheel_vanes.x, state_Big_pinwheel_vanes.y, 0.0f);
    glRotatef(state_Big_pinwheel_vanes.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Big_pinwheel_vanes.scaleX, state_Big_pinwheel_vanes.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLES);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.36f, 0.45f);
        glVertex2f(0.0000f, 0.3400f);
        glColor3f(1.00f, 0.36f, 0.45f);
        glVertex2f(0.2108f, 0.2108f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.82f, 0.30f);
        glVertex2f(-0.3400f, 0.0000f);
        glColor3f(1.00f, 0.82f, 0.30f);
        glVertex2f(-0.2108f, 0.2108f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.36f, 0.45f);
        glVertex2f(0.0000f, -0.3400f);
        glColor3f(1.00f, 0.36f, 0.45f);
        glVertex2f(-0.2108f, -0.2108f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.82f, 0.30f);
        glVertex2f(0.3400f, 0.0000f);
        glColor3f(1.00f, 0.82f, 0.30f);
        glVertex2f(0.2108f, -0.2108f);
    glEnd();
    glPopMatrix();
}

void draw_Big_pinwheel_stick()
{
    // Big pinwheel stick
    glPushMatrix();
    // Transform
    glTranslatef(state_Big_pinwheel_stick.x, state_Big_pinwheel_stick.y, 0.0f);
    glRotatef(state_Big_pinwheel_stick.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Big_pinwheel_stick.scaleX, state_Big_pinwheel_stick.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(4.00f);

    glBegin(GL_LINES);
        glColor3f(0.73f, 0.54f, 0.35f);
        glVertex2f(-0.8500f, 0.1200f);
        glColor3f(0.48f, 0.33f, 0.20f);
        glVertex2f(-0.8500f, -0.5700f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Middle_pinwheel_pin()
{
    // Middle pinwheel pin
    glPushMatrix();
    // Transform
    glTranslatef(state_Middle_pinwheel_pin.x, state_Middle_pinwheel_pin.y, 0.0f);
    glRotatef(state_Middle_pinwheel_pin.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Middle_pinwheel_pin.scaleX, state_Middle_pinwheel_pin.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0300f, 0.0000f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0260f, 0.0150f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0150f, 0.0260f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0000f, 0.0300f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0150f, 0.0260f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0260f, 0.0150f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0300f, 0.0000f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0260f, -0.0150f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0150f, -0.0260f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0000f, -0.0300f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0150f, -0.0260f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0260f, -0.0150f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0300f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Middle_pinwheel_vanes()
{
    // Middle pinwheel vanes
    glPushMatrix();
    // Transform
    glTranslatef(state_Middle_pinwheel_vanes.x, state_Middle_pinwheel_vanes.y, 0.0f);
    glRotatef(state_Middle_pinwheel_vanes.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Middle_pinwheel_vanes.scaleX, state_Middle_pinwheel_vanes.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLES);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.30f, 0.55f, 1.00f);
        glVertex2f(0.0000f, 0.2500f);
        glColor3f(0.30f, 0.55f, 1.00f);
        glVertex2f(0.1550f, 0.1550f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.48f, 0.88f, 0.76f);
        glVertex2f(-0.2500f, 0.0000f);
        glColor3f(0.48f, 0.88f, 0.76f);
        glVertex2f(-0.1550f, 0.1550f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.30f, 0.55f, 1.00f);
        glVertex2f(0.0000f, -0.2500f);
        glColor3f(0.30f, 0.55f, 1.00f);
        glVertex2f(-0.1550f, -0.1550f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.48f, 0.88f, 0.76f);
        glVertex2f(0.2500f, 0.0000f);
        glColor3f(0.48f, 0.88f, 0.76f);
        glVertex2f(0.1550f, -0.1550f);
    glEnd();
    glPopMatrix();
}

void draw_Middle_pinwheel_stick()
{
    // Middle pinwheel stick
    glPushMatrix();
    // Transform
    glTranslatef(state_Middle_pinwheel_stick.x, state_Middle_pinwheel_stick.y, 0.0f);
    glRotatef(state_Middle_pinwheel_stick.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Middle_pinwheel_stick.scaleX, state_Middle_pinwheel_stick.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(4.00f);

    glBegin(GL_LINES);
        glColor3f(0.73f, 0.54f, 0.35f);
        glVertex2f(0.2500f, 0.2600f);
        glColor3f(0.48f, 0.33f, 0.20f);
        glVertex2f(0.2500f, -0.5700f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Small_pinwheel_pin()
{
    // Small pinwheel pin
    glPushMatrix();
    // Transform
    glTranslatef(state_Small_pinwheel_pin.x, state_Small_pinwheel_pin.y, 0.0f);
    glRotatef(state_Small_pinwheel_pin.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Small_pinwheel_pin.scaleX, state_Small_pinwheel_pin.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0240f, 0.0000f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0208f, 0.0120f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0120f, 0.0208f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0000f, 0.0240f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0120f, 0.0208f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0208f, 0.0120f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0240f, 0.0000f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0208f, -0.0120f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(-0.0120f, -0.0208f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0000f, -0.0240f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0120f, -0.0208f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0208f, -0.0120f);
        glColor3f(0.79f, 0.81f, 0.85f);
        glVertex2f(0.0240f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Small_pinwheel_vanes()
{
    // Small pinwheel vanes
    glPushMatrix();
    // Transform
    glTranslatef(state_Small_pinwheel_vanes.x, state_Small_pinwheel_vanes.y, 0.0f);
    glRotatef(state_Small_pinwheel_vanes.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Small_pinwheel_vanes.scaleX, state_Small_pinwheel_vanes.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLES);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.64f, 0.42f, 1.00f);
        glVertex2f(0.0000f, 0.2000f);
        glColor3f(0.64f, 0.42f, 1.00f);
        glVertex2f(0.1240f, 0.1240f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.61f, 0.29f);
        glVertex2f(-0.2000f, 0.0000f);
        glColor3f(1.00f, 0.61f, 0.29f);
        glVertex2f(-0.1240f, 0.1240f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.64f, 0.42f, 1.00f);
        glVertex2f(0.0000f, -0.2000f);
        glColor3f(0.64f, 0.42f, 1.00f);
        glVertex2f(-0.1240f, -0.1240f);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.61f, 0.29f);
        glVertex2f(0.2000f, 0.0000f);
        glColor3f(1.00f, 0.61f, 0.29f);
        glVertex2f(0.1240f, -0.1240f);
    glEnd();
    glPopMatrix();
}

void draw_Small_pinwheel_stick()
{
    // Small pinwheel stick
    glPushMatrix();
    // Transform
    glTranslatef(state_Small_pinwheel_stick.x, state_Small_pinwheel_stick.y, 0.0f);
    glRotatef(state_Small_pinwheel_stick.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Small_pinwheel_stick.scaleX, state_Small_pinwheel_stick.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);
    glLineWidth(4.00f);

    glBegin(GL_LINES);
        glColor3f(0.73f, 0.54f, 0.35f);
        glVertex2f(1.0500f, 0.0200f);
        glColor3f(0.48f, 0.33f, 0.20f);
        glVertex2f(1.0500f, -0.5700f);
    glEnd();
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Hill()
{
    // Hill
    glPushMatrix();
    // Transform
    glTranslatef(state_Hill.x, state_Hill.y, 0.0f);
    glRotatef(state_Hill.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Hill.scaleX, state_Hill.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_STRIP);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(-1.6000f, -0.5888f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(-1.6000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(-1.4000f, -0.5894f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(-1.4000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(-1.2000f, -0.5830f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(-1.2000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(-1.0000f, -0.5702f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(-1.0000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(-0.8000f, -0.5523f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(-0.8000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(-0.6000f, -0.5312f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(-0.6000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(-0.4000f, -0.5088f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(-0.4000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(-0.2000f, -0.4877f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(-0.2000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(0.0000f, -0.4698f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(0.0000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(0.2000f, -0.4570f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(0.2000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(0.4000f, -0.4506f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(0.4000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(0.6000f, -0.4512f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(0.6000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(0.8000f, -0.4589f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(0.8000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(1.0000f, -0.4727f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(1.0000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(1.2000f, -0.4914f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(1.2000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(1.4000f, -0.5129f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(1.4000f, -0.9000f);
        glColor3f(0.53f, 0.84f, 0.44f);
        glVertex2f(1.6000f, -0.5352f);
        glColor3f(0.25f, 0.56f, 0.27f);
        glVertex2f(1.6000f, -0.9000f);
    glEnd();
    glPopMatrix();
}

void draw_Cloud_1()
{
    // Cloud 1
    glPushMatrix();
    // Transform
    glTranslatef(state_Cloud_1.x, state_Cloud_1.y, 0.0f);
    glRotatef(state_Cloud_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Cloud_1.scaleX, state_Cloud_1.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0800f, 0.0000f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0761f, 0.0247f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0647f, 0.0470f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0470f, 0.0647f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0247f, 0.0761f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0000f, 0.0800f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0247f, 0.0761f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0470f, 0.0647f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0647f, 0.0470f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0761f, 0.0247f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0800f, 0.0000f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0761f, -0.0247f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0647f, -0.0470f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0470f, -0.0647f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0247f, -0.0761f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0000f, -0.0800f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0247f, -0.0761f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0470f, -0.0647f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0647f, -0.0470f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0761f, -0.0247f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0800f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw_Cloud_2()
{
    // Cloud 2
    glPushMatrix();
    // Transform
    glTranslatef(state_Cloud_2.x, state_Cloud_2.y, 0.0f);
    glRotatef(state_Cloud_2.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Cloud_2.scaleX, state_Cloud_2.scaleY, 1.0f);

    // Render
    glShadeModel(GL_SMOOTH);

    glBegin(GL_TRIANGLE_FAN);
        glColor3f(1.00f, 1.00f, 1.00f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0800f, 0.0000f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0761f, 0.0247f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0647f, 0.0470f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0470f, 0.0647f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0247f, 0.0761f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0000f, 0.0800f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0247f, 0.0761f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0470f, 0.0647f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0647f, 0.0470f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0761f, 0.0247f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0800f, 0.0000f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0761f, -0.0247f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0647f, -0.0470f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0470f, -0.0647f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(-0.0247f, -0.0761f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0000f, -0.0800f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0247f, -0.0761f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0470f, -0.0647f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0647f, -0.0470f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0761f, -0.0247f);
        glColor3f(0.89f, 0.95f, 1.00f);
        glVertex2f(0.0800f, 0.0000f);
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
        glColor3f(1.00f, 0.98f, 0.84f);
        glVertex2f(0.0000f, 0.0000f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.1100f, 0.0000f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.1063f, 0.0285f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.0953f, 0.0550f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.0778f, 0.0778f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.0550f, 0.0953f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.0285f, 0.1063f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.0000f, 0.1100f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.0285f, 0.1063f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.0550f, 0.0953f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.0778f, 0.0778f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.0953f, 0.0550f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.1063f, 0.0285f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.1100f, 0.0000f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.1063f, -0.0285f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.0953f, -0.0550f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.0778f, -0.0778f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.0550f, -0.0953f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(-0.0285f, -0.1063f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.0000f, -0.1100f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.0285f, -0.1063f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.0550f, -0.0953f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.0778f, -0.0778f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.0953f, -0.0550f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.1063f, -0.0285f);
        glColor3f(1.00f, 0.83f, 0.30f);
        glVertex2f(0.1100f, 0.0000f);
    glEnd();
    glPopMatrix();
}

void draw()
{
    draw_Sun();
    draw_Cloud_2();
    draw_Cloud_1();
    draw_Hill();
    draw_Small_pinwheel_stick();
    // Small pinwheel
    glPushMatrix();
    // Transform
    glTranslatef(state_Small_pinwheel.x, state_Small_pinwheel.y, 0.0f);
    glRotatef(state_Small_pinwheel.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Small_pinwheel.scaleX, state_Small_pinwheel.scaleY, 1.0f);

    // Children
    draw_Small_pinwheel_vanes();
    draw_Small_pinwheel_pin();
    glPopMatrix();
    draw_Middle_pinwheel_stick();
    // Middle pinwheel
    glPushMatrix();
    // Transform
    glTranslatef(state_Middle_pinwheel.x, state_Middle_pinwheel.y, 0.0f);
    glRotatef(state_Middle_pinwheel.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Middle_pinwheel.scaleX, state_Middle_pinwheel.scaleY, 1.0f);

    // Children
    draw_Middle_pinwheel_vanes();
    draw_Middle_pinwheel_pin();
    glPopMatrix();
    draw_Big_pinwheel_stick();
    // Big pinwheel
    glPushMatrix();
    // Transform
    glTranslatef(state_Big_pinwheel.x, state_Big_pinwheel.y, 0.0f);
    glRotatef(state_Big_pinwheel.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Big_pinwheel.scaleX, state_Big_pinwheel.scaleY, 1.0f);

    // Children
    draw_Big_pinwheel_vanes();
    draw_Big_pinwheel_pin();
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
        state_Big_pinwheel = initial_Big_pinwheel;
        state_Middle_pinwheel = initial_Middle_pinwheel;
        state_Small_pinwheel = initial_Small_pinwheel;
        break;
    }
    glutPostRedisplay();
}

// Special keys callback: glutSpecialFunc
void onSpecial(int key, int x, int y)
{
    switch (key) {
    case GLUT_KEY_LEFT:
        state_Big_pinwheel.rotation += 30.00f;
        break;
    case GLUT_KEY_RIGHT:
        state_Big_pinwheel.rotation += -30.00f;
        break;
    }
    glutPostRedisplay();
}

// Idle callback: glutIdleFunc
void onIdle()
{
    state_Big_pinwheel.rotation += -5.00f;
    state_Middle_pinwheel.rotation += 7.00f;
    state_Small_pinwheel.rotation += -9.00f;
    glutPostRedisplay();
}

// One-time setup, called once before the main loop
void init()
{
    // No VBO primitives to initialise
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
    glutInitWindowSize(800, 450);
    glutCreateWindow("VAMS Preview");

    glewExperimental = GL_TRUE;
    if (glewInit() != GLEW_OK) {
        return 1; // GLEW failed to load OpenGL extensions
    }

    glClearColor(0.62f, 0.85f, 1.00f, 1.0f);

    init();

    glutDisplayFunc(display);
    glutKeyboardFunc(onKey);
    glutSpecialFunc(onSpecial);
    glutIdleFunc(_vams_idle);

    glutMainLoop();
    return 0;
}
