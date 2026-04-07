export type ScoutResult = {
  filePath: string
  imports: string[]
  exports: string[]
  functions: string[]
  classes: string[]
  frameworkHints: string[]
  /**
   * Type/interface aliases that look like React prop containers
   * (e.g. Props, ButtonProps, ComponentProps)
   */
  propTypes: string[]
  /**
   * Text safe for prompts: source for text files, or a short placeholder for
   * binary assets (images, fonts, etc.) so high-detail mode stays readable.
   */
  raw: string
  /**
   * Present when the file was not fully read/parsed (size cap or I/O error).
   */
  readIssue?: "too-large" | "read-error"
}