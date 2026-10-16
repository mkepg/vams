import { CPP_KEYWORDS } from '@/core/callbacks/cpp-keywords';

/** An object's name as the generated program writes it: a valid C++ identifier ("My Shape" → My_Shape, class → class_obj). */
export const sanitizeName = (name: string): string => {
  let sanitized = name.replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^[0-9]/.test(sanitized)) sanitized = '_' + sanitized;
  if (CPP_KEYWORDS.has(sanitized)) sanitized = sanitized + '_obj';
  return sanitized;
};
