declare module "@jeonghyeon.net/pi-supervisor/src/index" {
  const extension: (pi: { [key: string]: unknown }) => void | Promise<void>;
  export default extension;
}
