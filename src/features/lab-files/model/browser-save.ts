/** Said once this browser couldn't keep part of the work. */
export const BROWSER_SAVE_FAILED = "This browser couldn't keep your work. Save it to a file before you leave.";

/** What Run's messages say about the browser save. */
const SAVED_CLAIM = 'Your code is saved in this browser.';

/** A Run message as it stands once the browser save has failed: it tells the student to save to a file instead. */
export function withBrowserSave(message: string | null, failed: boolean): string | null {
  return failed && message ? message.replace(SAVED_CLAIM, BROWSER_SAVE_FAILED) : message;
}

/** Names as a sentence lists them: "a.png", "a.png and b.png", "a.png, b.png and c.png". */
function listed(names: readonly string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Said when files in the list had no bytes left in this browser and were taken out. */
export function missingFilesMessage(names: readonly string[]): string {
  return names.length === 1
    ? `${names[0]} couldn't be found in this browser, so it left the list. Add it again.`
    : `${listed(names)} couldn't be found in this browser, so they left the list. Add them again.`;
}
