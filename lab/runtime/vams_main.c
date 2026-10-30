// The Lab's main module. It holds everything a student's program shares
// (libc, libc++ and the bridges to the worker) and runs the program, which
// arrives as a side module.

#include <dlfcn.h>
#include <stdio.h>

#include <emscripten.h>

typedef int (*main_fn)(int, char **);

// Loads the side module at `path`, calls its main and returns the exit code.
// Returns 127 when the module can't be loaded or has no main.
EMSCRIPTEN_KEEPALIVE int vams_run(const char *path) {
  void *program = dlopen(path, RTLD_NOW | RTLD_GLOBAL);
  if (!program) {
    fprintf(stderr, "%s\n", dlerror());
    return 127;
  }

  // clang exports int main(int, char**) as __main_argc_argv. For int main()
  // it exports main, a wrapper that takes the same two arguments.
  main_fn entry = (main_fn)dlsym(program, "__main_argc_argv");
  if (!entry) entry = (main_fn)dlsym(program, "main");
  if (!entry) {
    fprintf(stderr, "%s has no main\n", path);
    return 127;
  }

  char name[] = "program";
  char *argv[] = {name, NULL};
  int code = entry(1, argv);

  fflush(stdout);
  fflush(stderr);
  return code;
}
