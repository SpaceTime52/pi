import base from "@jeonghyeon.net/pi-supervisor/src/index";

export default function (pi: { [key: string]: unknown }): void | Promise<void> {
  return base(pi);
}
