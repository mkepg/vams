#include <GL/glew.h>
#include <GL/freeglut.h>
#include <cmath>

// --- Global State ---
struct ObjectState {
    float x, y;
    float rotation;
    float scaleX, scaleY;
};

ObjectState state_Wall_4 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Wall_3 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Wall_2 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Wall_1 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Terrace_4 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Terrace_3 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Terrace_2 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Terrace_1 = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Mountains = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Sun = { 0.5500f, 0.4500f, 0.0000f, 1.0000f, 1.0000f };
ObjectState state_Sky = { 0.0000f, 0.0000f, 0.0000f, 1.0000f, 1.0000f };
const ObjectState initial_Sun = { 0.5500f, 0.4500f, 0.0000f, 1.0000f, 1.0000f };

// --- View (the glOrtho bounds, updated by the reshape callback) ---
float viewMinX = -1.6000f, viewMaxX = 1.6000f, viewMinY = -0.9000f, viewMaxY = 0.9000f;

// --- Buffer Data ---
GLfloat verts_Wall_4[] = { -1.6000f, -0.7069f, -1.4000f, -0.6931f, -1.2000f, -0.6858f, -1.0000f, -0.6862f, -0.8000f, -0.6942f, -0.6000f, -0.7084f, -0.4000f, -0.7263f, -0.2000f, -0.7449f, 0.0000f, -0.7609f, 0.2000f, -0.7716f, 0.4000f, -0.7750f, 0.6000f, -0.7706f, 0.8000f, -0.7591f, 1.0000f, -0.7426f, 1.2000f, -0.7239f, 1.4000f, -0.7062f, 1.6000f, -0.6927f };
GLfloat colors_Wall_4[] = { 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f };
GLfloat verts_Wall_3[] = { -1.6000f, -0.5710f, -1.4000f, -0.5550f, -1.2000f, -0.5364f, -1.0000f, -0.5184f, -0.8000f, -0.5042f, -0.6000f, -0.4962f, -0.4000f, -0.4958f, -0.2000f, -0.5031f, 0.0000f, -0.5168f, 0.2000f, -0.5345f, 0.4000f, -0.5532f, 0.6000f, -0.5696f, 0.8000f, -0.5809f, 1.0000f, -0.5850f, 1.2000f, -0.5813f, 1.4000f, -0.5704f, 1.6000f, -0.5543f };
GLfloat colors_Wall_3[] = { 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f };
GLfloat verts_Wall_2[] = { -1.6000f, -0.3897f, -1.4000f, -0.3949f, -1.2000f, -0.3923f, -1.0000f, -0.3823f, -0.8000f, -0.3667f, -0.6000f, -0.3482f, -0.4000f, -0.3300f, -0.2000f, -0.3153f, 0.0000f, -0.3066f, 0.2000f, -0.3055f, 0.4000f, -0.3121f, 0.6000f, -0.3253f, 0.8000f, -0.3428f, 1.0000f, -0.3615f, 1.2000f, -0.3782f, 1.4000f, -0.3901f, 1.6000f, -0.3949f };
GLfloat colors_Wall_2[] = { 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f };
GLfloat verts_Wall_1[] = { -1.6000f, -0.1502f, -1.4000f, -0.1690f, -1.2000f, -0.1862f, -1.0000f, -0.1988f, -0.8000f, -0.2047f, -0.6000f, -0.2028f, -0.4000f, -0.1935f, -0.2000f, -0.1783f, 0.0000f, -0.1600f, 0.2000f, -0.1417f, 0.4000f, -0.1265f, 0.6000f, -0.1172f, 0.8000f, -0.1153f, 1.0000f, -0.1212f, 1.2000f, -0.1338f, 1.4000f, -0.1510f, 1.6000f, -0.1698f };
GLfloat colors_Wall_1[] = { 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f, 0.89f, 0.96f, 0.69f };
GLfloat verts_Terrace_4[] = { -1.6000f, -0.7069f, -1.6000f, -0.9000f, -1.4000f, -0.9000f, -1.4000f, -0.6931f, -1.2000f, -0.9000f, -1.2000f, -0.6858f, -1.0000f, -0.9000f, -1.0000f, -0.6862f, -0.8000f, -0.9000f, -0.8000f, -0.6942f, -0.6000f, -0.9000f, -0.6000f, -0.7084f, -0.4000f, -0.9000f, -0.4000f, -0.7263f, -0.2000f, -0.9000f, -0.2000f, -0.7449f, 0.0000f, -0.9000f, 0.0000f, -0.7609f, 0.2000f, -0.9000f, 0.2000f, -0.7716f, 0.4000f, -0.9000f, 0.4000f, -0.7750f, 0.6000f, -0.9000f, 0.6000f, -0.7706f, 0.8000f, -0.9000f, 0.8000f, -0.7591f, 1.0000f, -0.9000f, 1.0000f, -0.7426f, 1.2000f, -0.9000f, 1.2000f, -0.7239f, 1.4000f, -0.9000f, 1.4000f, -0.7062f, 1.6000f, -0.9000f, 1.6000f, -0.6927f };
GLfloat colors_Terrace_4[] = { 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f, 0.25f, 0.44f, 0.14f, 0.42f, 0.66f, 0.24f };
GLuint indices_Terrace_4[] = { 0, 1, 2, 3, 3, 2, 4, 5, 5, 4, 6, 7, 7, 6, 8, 9, 9, 8, 10, 11, 11, 10, 12, 13, 13, 12, 14, 15, 15, 14, 16, 17, 17, 16, 18, 19, 19, 18, 20, 21, 21, 20, 22, 23, 23, 22, 24, 25, 25, 24, 26, 27, 27, 26, 28, 29, 29, 28, 30, 31, 31, 30, 32, 33 };
GLfloat verts_Terrace_3[] = { -1.6000f, -0.5710f, -1.6000f, -0.7069f, -1.4000f, -0.6931f, -1.4000f, -0.5550f, -1.2000f, -0.6858f, -1.2000f, -0.5364f, -1.0000f, -0.6862f, -1.0000f, -0.5184f, -0.8000f, -0.6942f, -0.8000f, -0.5042f, -0.6000f, -0.7084f, -0.6000f, -0.4962f, -0.4000f, -0.7263f, -0.4000f, -0.4958f, -0.2000f, -0.7449f, -0.2000f, -0.5031f, 0.0000f, -0.7609f, 0.0000f, -0.5168f, 0.2000f, -0.7716f, 0.2000f, -0.5345f, 0.4000f, -0.7750f, 0.4000f, -0.5532f, 0.6000f, -0.7706f, 0.6000f, -0.5696f, 0.8000f, -0.7591f, 0.8000f, -0.5809f, 1.0000f, -0.7426f, 1.0000f, -0.5850f, 1.2000f, -0.7239f, 1.2000f, -0.5813f, 1.4000f, -0.7062f, 1.4000f, -0.5704f, 1.6000f, -0.6927f, 1.6000f, -0.5543f };
GLfloat colors_Terrace_3[] = { 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f, 0.31f, 0.51f, 0.17f, 0.50f, 0.73f, 0.28f };
GLuint indices_Terrace_3[] = { 0, 1, 2, 3, 3, 2, 4, 5, 5, 4, 6, 7, 7, 6, 8, 9, 9, 8, 10, 11, 11, 10, 12, 13, 13, 12, 14, 15, 15, 14, 16, 17, 17, 16, 18, 19, 19, 18, 20, 21, 21, 20, 22, 23, 23, 22, 24, 25, 25, 24, 26, 27, 27, 26, 28, 29, 29, 28, 30, 31, 31, 30, 32, 33 };
GLfloat verts_Terrace_2[] = { -1.6000f, -0.3897f, -1.6000f, -0.5710f, -1.4000f, -0.5550f, -1.4000f, -0.3949f, -1.2000f, -0.5364f, -1.2000f, -0.3923f, -1.0000f, -0.5184f, -1.0000f, -0.3823f, -0.8000f, -0.5042f, -0.8000f, -0.3667f, -0.6000f, -0.4962f, -0.6000f, -0.3482f, -0.4000f, -0.4958f, -0.4000f, -0.3300f, -0.2000f, -0.5031f, -0.2000f, -0.3153f, 0.0000f, -0.5168f, 0.0000f, -0.3066f, 0.2000f, -0.5345f, 0.2000f, -0.3055f, 0.4000f, -0.5532f, 0.4000f, -0.3121f, 0.6000f, -0.5696f, 0.6000f, -0.3253f, 0.8000f, -0.5809f, 0.8000f, -0.3428f, 1.0000f, -0.5850f, 1.0000f, -0.3615f, 1.2000f, -0.5813f, 1.2000f, -0.3782f, 1.4000f, -0.5704f, 1.4000f, -0.3901f, 1.6000f, -0.5543f, 1.6000f, -0.3949f };
GLfloat colors_Terrace_2[] = { 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f, 0.37f, 0.58f, 0.20f, 0.58f, 0.79f, 0.32f };
GLuint indices_Terrace_2[] = { 0, 1, 2, 3, 3, 2, 4, 5, 5, 4, 6, 7, 7, 6, 8, 9, 9, 8, 10, 11, 11, 10, 12, 13, 13, 12, 14, 15, 15, 14, 16, 17, 17, 16, 18, 19, 19, 18, 20, 21, 21, 20, 22, 23, 23, 22, 24, 25, 25, 24, 26, 27, 27, 26, 28, 29, 29, 28, 30, 31, 31, 30, 32, 33 };
GLfloat verts_Terrace_1[] = { -1.6000f, -0.1502f, -1.6000f, -0.3897f, -1.4000f, -0.3949f, -1.4000f, -0.1690f, -1.2000f, -0.3923f, -1.2000f, -0.1862f, -1.0000f, -0.3823f, -1.0000f, -0.1988f, -0.8000f, -0.3667f, -0.8000f, -0.2047f, -0.6000f, -0.3482f, -0.6000f, -0.2028f, -0.4000f, -0.3300f, -0.4000f, -0.1935f, -0.2000f, -0.3153f, -0.2000f, -0.1783f, 0.0000f, -0.3066f, 0.0000f, -0.1600f, 0.2000f, -0.3055f, 0.2000f, -0.1417f, 0.4000f, -0.3121f, 0.4000f, -0.1265f, 0.6000f, -0.3253f, 0.6000f, -0.1172f, 0.8000f, -0.3428f, 0.8000f, -0.1153f, 1.0000f, -0.3615f, 1.0000f, -0.1212f, 1.2000f, -0.3782f, 1.2000f, -0.1338f, 1.4000f, -0.3901f, 1.4000f, -0.1510f, 1.6000f, -0.3949f, 1.6000f, -0.1698f };
GLfloat colors_Terrace_1[] = { 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f, 0.44f, 0.65f, 0.24f, 0.65f, 0.84f, 0.37f };
GLuint indices_Terrace_1[] = { 0, 1, 2, 3, 3, 2, 4, 5, 5, 4, 6, 7, 7, 6, 8, 9, 9, 8, 10, 11, 11, 10, 12, 13, 13, 12, 14, 15, 15, 14, 16, 17, 17, 16, 18, 19, 19, 18, 20, 21, 21, 20, 22, 23, 23, 22, 24, 25, 25, 24, 26, 27, 27, 26, 28, 29, 29, 28, 30, 31, 31, 30, 32, 33 };
GLfloat verts_Mountains[] = { -1.6000f, 0.1972f, -1.6000f, -0.5000f, -1.4000f, 0.2468f, -1.4000f, -0.5000f, -1.2000f, 0.2796f, -1.2000f, -0.5000f, -1.0000f, 0.2342f, -1.0000f, -0.5000f, -0.8000f, 0.2311f, -0.8000f, -0.5000f, -0.6000f, 0.2130f, -0.6000f, -0.5000f, -0.4000f, 0.1242f, -0.4000f, -0.5000f, -0.2000f, 0.1096f, -0.2000f, -0.5000f, 0.0000f, 0.1823f, 0.0000f, -0.5000f, 0.2000f, 0.1879f, 0.2000f, -0.5000f, 0.4000f, 0.2411f, 0.4000f, -0.5000f, 0.6000f, 0.2782f, 0.6000f, -0.5000f, 0.8000f, 0.2371f, 0.8000f, -0.5000f, 1.0000f, 0.2381f, 1.0000f, -0.5000f, 1.2000f, 0.2233f, 1.2000f, -0.5000f, 1.4000f, 0.1366f, 1.4000f, -0.5000f, 1.6000f, 0.1035f, 1.6000f, -0.5000f };
GLfloat colors_Mountains[] = { 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f, 0.35f, 0.29f, 0.55f, 0.18f, 0.16f, 0.34f };
GLfloat verts_Sun[] = { 0.0000f, 0.0000f, 0.1300f, 0.0000f, 0.1267f, 0.0289f, 0.1171f, 0.0564f, 0.1016f, 0.0811f, 0.0811f, 0.1016f, 0.0564f, 0.1171f, 0.0289f, 0.1267f, 0.0000f, 0.1300f, -0.0289f, 0.1267f, -0.0564f, 0.1171f, -0.0811f, 0.1016f, -0.1016f, 0.0811f, -0.1171f, 0.0564f, -0.1267f, 0.0289f, -0.1300f, 0.0000f, -0.1267f, -0.0289f, -0.1171f, -0.0564f, -0.1016f, -0.0811f, -0.0811f, -0.1016f, -0.0564f, -0.1171f, -0.0289f, -0.1267f, 0.0000f, -0.1300f, 0.0289f, -0.1267f, 0.0564f, -0.1171f, 0.0811f, -0.1016f, 0.1016f, -0.0811f, 0.1171f, -0.0564f, 0.1267f, -0.0289f, 0.1300f, 0.0000f };
GLfloat colors_Sun[] = { 1.00f, 0.95f, 0.77f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f, 1.00f, 0.58f, 0.28f };
GLfloat verts_Sky[] = { -1.6000f, 0.9000f, 1.6000f, 0.9000f, 1.6000f, -0.9000f, -1.6000f, -0.9000f };
GLfloat colors_Sky[] = { 0.15f, 0.14f, 0.37f, 0.15f, 0.14f, 0.37f, 0.95f, 0.60f, 0.33f, 0.95f, 0.60f, 0.33f };

// --- VBO Handles ---
GLuint vbo_Terrace_4 = 0;
GLuint cbo_Terrace_4 = 0;
GLuint ebo_Terrace_4 = 0;
GLuint vbo_Terrace_3 = 0;
GLuint cbo_Terrace_3 = 0;
GLuint ebo_Terrace_3 = 0;
GLuint vbo_Terrace_2 = 0;
GLuint cbo_Terrace_2 = 0;
GLuint ebo_Terrace_2 = 0;
GLuint vbo_Terrace_1 = 0;
GLuint cbo_Terrace_1 = 0;
GLuint ebo_Terrace_1 = 0;
GLuint vbo_Mountains = 0;
GLuint cbo_Mountains = 0;
GLuint vbo_Sun = 0;
GLuint cbo_Sun = 0;

void draw_Wall_4();
void draw_Wall_3();
void draw_Wall_2();
void draw_Wall_1();
void draw_Terrace_4();
void draw_Terrace_3();
void draw_Terrace_2();
void draw_Terrace_1();
void draw_Mountains();
void draw_Sun();
void draw_Sky();
void init();

void draw_Wall_4()
{
    // Wall 4
    glPushMatrix();
    glTranslatef(state_Wall_4.x, state_Wall_4.y, 0.0f);
    glRotatef(state_Wall_4.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Wall_4.scaleX, state_Wall_4.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);
    glLineWidth(2.00f);

    // Bind client-side arrays
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);
    glVertexPointer(2, GL_FLOAT, 0, verts_Wall_4);
    glColorPointer(3, GL_FLOAT, 0, colors_Wall_4);

    glDrawArrays(GL_LINE_STRIP, 0, 17);

    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Wall_3()
{
    // Wall 3
    glPushMatrix();
    glTranslatef(state_Wall_3.x, state_Wall_3.y, 0.0f);
    glRotatef(state_Wall_3.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Wall_3.scaleX, state_Wall_3.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);
    glLineWidth(2.00f);

    // Bind client-side arrays
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);
    glVertexPointer(2, GL_FLOAT, 0, verts_Wall_3);
    glColorPointer(3, GL_FLOAT, 0, colors_Wall_3);

    glDrawArrays(GL_LINE_STRIP, 0, 17);

    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Wall_2()
{
    // Wall 2
    glPushMatrix();
    glTranslatef(state_Wall_2.x, state_Wall_2.y, 0.0f);
    glRotatef(state_Wall_2.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Wall_2.scaleX, state_Wall_2.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);
    glLineWidth(2.00f);

    // Bind client-side arrays
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);
    glVertexPointer(2, GL_FLOAT, 0, verts_Wall_2);
    glColorPointer(3, GL_FLOAT, 0, colors_Wall_2);

    glDrawArrays(GL_LINE_STRIP, 0, 17);

    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Wall_1()
{
    // Wall 1
    glPushMatrix();
    glTranslatef(state_Wall_1.x, state_Wall_1.y, 0.0f);
    glRotatef(state_Wall_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Wall_1.scaleX, state_Wall_1.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);
    glLineWidth(2.00f);

    // Bind client-side arrays
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);
    glVertexPointer(2, GL_FLOAT, 0, verts_Wall_1);
    glColorPointer(3, GL_FLOAT, 0, colors_Wall_1);

    glDrawArrays(GL_LINE_STRIP, 0, 17);

    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glLineWidth(1.0f);
    glPopMatrix();
}

void draw_Terrace_4()
{
    // Terrace 4
    glPushMatrix();
    glTranslatef(state_Terrace_4.x, state_Terrace_4.y, 0.0f);
    glRotatef(state_Terrace_4.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Terrace_4.scaleX, state_Terrace_4.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind GPU buffers
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);

    glBindBuffer(GL_ARRAY_BUFFER, vbo_Terrace_4);
    glVertexPointer(2, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, cbo_Terrace_4);
    glColorPointer(3, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo_Terrace_4);
    glDrawElements(GL_QUADS, 64, GL_UNSIGNED_INT, 0);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw_Terrace_3()
{
    // Terrace 3
    glPushMatrix();
    glTranslatef(state_Terrace_3.x, state_Terrace_3.y, 0.0f);
    glRotatef(state_Terrace_3.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Terrace_3.scaleX, state_Terrace_3.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind GPU buffers
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);

    glBindBuffer(GL_ARRAY_BUFFER, vbo_Terrace_3);
    glVertexPointer(2, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, cbo_Terrace_3);
    glColorPointer(3, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo_Terrace_3);
    glDrawElements(GL_QUADS, 64, GL_UNSIGNED_INT, 0);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw_Terrace_2()
{
    // Terrace 2
    glPushMatrix();
    glTranslatef(state_Terrace_2.x, state_Terrace_2.y, 0.0f);
    glRotatef(state_Terrace_2.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Terrace_2.scaleX, state_Terrace_2.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind GPU buffers
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);

    glBindBuffer(GL_ARRAY_BUFFER, vbo_Terrace_2);
    glVertexPointer(2, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, cbo_Terrace_2);
    glColorPointer(3, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo_Terrace_2);
    glDrawElements(GL_QUADS, 64, GL_UNSIGNED_INT, 0);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw_Terrace_1()
{
    // Terrace 1
    glPushMatrix();
    glTranslatef(state_Terrace_1.x, state_Terrace_1.y, 0.0f);
    glRotatef(state_Terrace_1.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Terrace_1.scaleX, state_Terrace_1.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind GPU buffers
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);

    glBindBuffer(GL_ARRAY_BUFFER, vbo_Terrace_1);
    glVertexPointer(2, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, cbo_Terrace_1);
    glColorPointer(3, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo_Terrace_1);
    glDrawElements(GL_QUADS, 64, GL_UNSIGNED_INT, 0);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw_Mountains()
{
    // Mountains
    glPushMatrix();
    glTranslatef(state_Mountains.x, state_Mountains.y, 0.0f);
    glRotatef(state_Mountains.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Mountains.scaleX, state_Mountains.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind GPU buffers
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);

    glBindBuffer(GL_ARRAY_BUFFER, vbo_Mountains);
    glVertexPointer(2, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, cbo_Mountains);
    glColorPointer(3, GL_FLOAT, 0, 0);

    glDrawArrays(GL_TRIANGLE_STRIP, 0, 34);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw_Sun()
{
    // Sun
    glPushMatrix();
    glTranslatef(state_Sun.x, state_Sun.y, 0.0f);
    glRotatef(state_Sun.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Sun.scaleX, state_Sun.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind GPU buffers
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);

    glBindBuffer(GL_ARRAY_BUFFER, vbo_Sun);
    glVertexPointer(2, GL_FLOAT, 0, 0);

    glBindBuffer(GL_ARRAY_BUFFER, cbo_Sun);
    glColorPointer(3, GL_FLOAT, 0, 0);

    glDrawArrays(GL_TRIANGLE_FAN, 0, 30);

    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw_Sky()
{
    // Sky
    glPushMatrix();
    glTranslatef(state_Sky.x, state_Sky.y, 0.0f);
    glRotatef(state_Sky.rotation, 0.0f, 0.0f, 1.0f);
    glScalef(state_Sky.scaleX, state_Sky.scaleY, 1.0f);
    glShadeModel(GL_SMOOTH);

    // Bind client-side arrays
    glEnableClientState(GL_VERTEX_ARRAY);
    glEnableClientState(GL_COLOR_ARRAY);
    glVertexPointer(2, GL_FLOAT, 0, verts_Sky);
    glColorPointer(3, GL_FLOAT, 0, colors_Sky);

    glDrawArrays(GL_QUADS, 0, 4);

    glDisableClientState(GL_COLOR_ARRAY);
    glDisableClientState(GL_VERTEX_ARRAY);
    glPopMatrix();
}

void draw()
{
    draw_Sky();
    draw_Sun();
    draw_Mountains();
    draw_Terrace_1();
    draw_Terrace_2();
    draw_Terrace_3();
    draw_Terrace_4();
    draw_Wall_1();
    draw_Wall_2();
    draw_Wall_3();
    draw_Wall_4();
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

// Convert a window pixel (GLUT's origin is top-left) to world coordinates
void windowToWorld(int x, int y, float* wx, float* wy)
{
    int w = glutGet(GLUT_WINDOW_WIDTH);
    int h = glutGet(GLUT_WINDOW_HEIGHT);
    *wx = viewMinX + (viewMaxX - viewMinX) * x / (float)(w > 0 ? w : 1);
    *wy = viewMaxY - (viewMaxY - viewMinY) * y / (float)(h > 0 ? h : 1);
}

// Keyboard callback: glutKeyboardFunc
void onKey(unsigned char key, int x, int y)
{
    switch (key) {
    case ' ':
        state_Sun = initial_Sun;
        break;
    }
    glutPostRedisplay();
}

// Motion callback: glutMotionFunc
void onDrag(int x, int y)
{
    float wx, wy;
    windowToWorld(x, y, &wx, &wy);
    state_Sun.x = wx;
    state_Sun.y = wy;
    glutPostRedisplay();
}

// One-time setup, called once before the main loop
void init()
{
    // Terrace 4 — upload to GPU
    glGenBuffers(1, &vbo_Terrace_4);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_Terrace_4);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_Terrace_4), verts_Terrace_4, GL_STATIC_DRAW);
    glGenBuffers(1, &cbo_Terrace_4);
    glBindBuffer(GL_ARRAY_BUFFER, cbo_Terrace_4);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_Terrace_4), colors_Terrace_4, GL_STATIC_DRAW);
    glGenBuffers(1, &ebo_Terrace_4);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo_Terrace_4);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices_Terrace_4), indices_Terrace_4, GL_STATIC_DRAW);

    // Terrace 3 — upload to GPU
    glGenBuffers(1, &vbo_Terrace_3);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_Terrace_3);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_Terrace_3), verts_Terrace_3, GL_STATIC_DRAW);
    glGenBuffers(1, &cbo_Terrace_3);
    glBindBuffer(GL_ARRAY_BUFFER, cbo_Terrace_3);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_Terrace_3), colors_Terrace_3, GL_STATIC_DRAW);
    glGenBuffers(1, &ebo_Terrace_3);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo_Terrace_3);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices_Terrace_3), indices_Terrace_3, GL_STATIC_DRAW);

    // Terrace 2 — upload to GPU
    glGenBuffers(1, &vbo_Terrace_2);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_Terrace_2);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_Terrace_2), verts_Terrace_2, GL_STATIC_DRAW);
    glGenBuffers(1, &cbo_Terrace_2);
    glBindBuffer(GL_ARRAY_BUFFER, cbo_Terrace_2);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_Terrace_2), colors_Terrace_2, GL_STATIC_DRAW);
    glGenBuffers(1, &ebo_Terrace_2);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo_Terrace_2);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices_Terrace_2), indices_Terrace_2, GL_STATIC_DRAW);

    // Terrace 1 — upload to GPU
    glGenBuffers(1, &vbo_Terrace_1);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_Terrace_1);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_Terrace_1), verts_Terrace_1, GL_STATIC_DRAW);
    glGenBuffers(1, &cbo_Terrace_1);
    glBindBuffer(GL_ARRAY_BUFFER, cbo_Terrace_1);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_Terrace_1), colors_Terrace_1, GL_STATIC_DRAW);
    glGenBuffers(1, &ebo_Terrace_1);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, ebo_Terrace_1);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, sizeof(indices_Terrace_1), indices_Terrace_1, GL_STATIC_DRAW);

    // Mountains — upload to GPU
    glGenBuffers(1, &vbo_Mountains);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_Mountains);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_Mountains), verts_Mountains, GL_STATIC_DRAW);
    glGenBuffers(1, &cbo_Mountains);
    glBindBuffer(GL_ARRAY_BUFFER, cbo_Mountains);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_Mountains), colors_Mountains, GL_STATIC_DRAW);

    // Sun — upload to GPU
    glGenBuffers(1, &vbo_Sun);
    glBindBuffer(GL_ARRAY_BUFFER, vbo_Sun);
    glBufferData(GL_ARRAY_BUFFER, sizeof(verts_Sun), verts_Sun, GL_STATIC_DRAW);
    glGenBuffers(1, &cbo_Sun);
    glBindBuffer(GL_ARRAY_BUFFER, cbo_Sun);
    glBufferData(GL_ARRAY_BUFFER, sizeof(colors_Sun), colors_Sun, GL_STATIC_DRAW);

    // Unbind, so client-side arrays read from memory again
    glBindBuffer(GL_ARRAY_BUFFER, 0);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, 0);
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

    glClearColor(0.15f, 0.14f, 0.37f, 1.0f);

    init();

    glutDisplayFunc(display);
    glutKeyboardFunc(onKey);
    glutMotionFunc(onDrag);

    glutMainLoop();
    return 0;
}
