#ifndef STBI_INCLUDE_STB_IMAGE_H
#define STBI_INCLUDE_STB_IMAGE_H

/*
 * stb_image.h for VAMS Lab: the declarations of stb_image v2.30, the version
 * in the course setup. The implementation is already built into the Lab's
 * runtime, so defining STB_IMAGE_IMPLEMENTATION before including this file
 * adds nothing. Files are read by name from the Lab's file list.
 */

#include <stdio.h>
#include <stdlib.h>

#define STBI_VERSION 1

#ifndef STBIDEF
#define STBIDEF extern
#endif

#ifdef __cplusplus
extern "C" {
#endif

enum {
  STBI_default = 0,
  STBI_grey = 1,
  STBI_grey_alpha = 2,
  STBI_rgb = 3,
  STBI_rgb_alpha = 4
};

typedef unsigned char stbi_uc;
typedef unsigned short stbi_us;

STBIDEF stbi_uc *stbi_load(char const *filename, int *x, int *y, int *channels_in_file, int desired_channels);
STBIDEF stbi_uc *stbi_load_from_memory(stbi_uc const *buffer, int len, int *x, int *y, int *channels_in_file, int desired_channels);
STBIDEF stbi_uc *stbi_load_from_file(FILE *f, int *x, int *y, int *channels_in_file, int desired_channels);
STBIDEF void stbi_image_free(void *retval_from_stbi_load);
STBIDEF const char *stbi_failure_reason(void);
STBIDEF void stbi_set_flip_vertically_on_load(int flag_true_if_should_flip);
STBIDEF int stbi_info(char const *filename, int *x, int *y, int *comp);
STBIDEF int stbi_info_from_memory(stbi_uc const *buffer, int len, int *x, int *y, int *comp);
STBIDEF int stbi_info_from_file(FILE *f, int *x, int *y, int *comp);

#ifdef __cplusplus
}
#endif

#endif /* STBI_INCLUDE_STB_IMAGE_H */
