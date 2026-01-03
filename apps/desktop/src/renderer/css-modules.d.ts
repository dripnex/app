/**
 * CSS Modules type declaration
 * Allows importing .module.css files in TypeScript
 */
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
