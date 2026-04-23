declare module "@jeonghyeon.net/pi-tasks/dist/index.js" {
  const extension: (pi: { [key: string]: unknown }) => void | Promise<void>;
  export default extension;
}
