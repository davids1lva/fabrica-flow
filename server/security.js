import {
  scrypt,
  randomBytes,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export const id = randomUUID;
export const token = () => randomBytes(32).toString("hex");
export const hash = (v) => createHash("sha256").update(v).digest("hex");
export async function pinHash(pin) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + Buffer.from(await derive(pin, salt, 64)).toString("hex");
}
export async function checkPin(pin, stored) {
  const [salt, h] = stored.split(":");
  return timingSafeEqual(
    Buffer.from(h, "hex"),
    Buffer.from(await derive(pin, salt, 64)),
  );
}
export function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter((x) => x.includes("="))
      .map((x) => {
        const p = x.trim().indexOf("=");
        const s = x.trim();
        return [s.slice(0, p), s.slice(p + 1)];
      }),
  );
}
export function fail(status, message) {
  throw Object.assign(Error(message), { status });
}
