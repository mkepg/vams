/** One compiler message on the student's file, as the compiler reports it. */
export interface Diagnostic {
  file: 'main.cpp';
  line: number;
  col: number;
  severity: 'error' | 'warning' | 'note';
  message: string;
}
