// Images the package ships (assets/brand); Vite turns each import into its URL.
declare module '*.svg' {
  const url: string;
  export default url;
}
