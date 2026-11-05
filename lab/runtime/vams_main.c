// The Lab's main module. It holds everything a student's program shares
// (libc, libc++, stb_image, the Windows extras and the bridges to the worker:
// conio.c, windows.c, glew.c, stb_image_impl.c and library_vams.js) and runs
// the program, which arrives as a side module.

#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>

#include <emscripten.h>

typedef int (*main_fn)(int, char **);

// Flushes every stream, as a lab PC does when a program ends: an unclosed
// FILE* keeps what it wrote. Registered first, so it runs last, after the
// program's own atexit handlers and its static destructors.
static void flush_all(void) { fflush(NULL); }

// Loads the side module at `path`, runs its main and ends with exit(), so
// every way a program ends runs its static destructors and flushes its files
// (the main module is linked with EXIT_RUNTIME). The exit code reaches the
// worker as Emscripten's ExitStatus. It is 127 when the module can't be loaded
// or has no main.
EMSCRIPTEN_KEEPALIVE int vams_run(const char *path) {
  atexit(flush_all);
  // stdout is unbuffered, as a console window's is on a lab PC, so a partial
  // line shows as soon as it is printed. stderr is unbuffered already.
  setvbuf(stdout, NULL, _IONBF, 0);

  void *program = dlopen(path, RTLD_NOW | RTLD_GLOBAL);
  if (!program) {
    fprintf(stderr, "%s\n", dlerror());
    exit(127);
  }

  // clang exports int main(int, char**) as __main_argc_argv. For int main()
  // it exports main, a wrapper that takes the same two arguments.
  main_fn entry = (main_fn)dlsym(program, "__main_argc_argv");
  if (!entry) entry = (main_fn)dlsym(program, "main");
  if (!entry) {
    fprintf(stderr, "%s has no main\n", path);
    exit(127);
  }

  char name[] = "program";
  char *argv[] = {name, NULL};
  int code = entry(1, argv);
  fflush(NULL);
  exit(code);
}
