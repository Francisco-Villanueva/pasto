import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/** Variables de entorno del servidor, validadas la primera vez que se piden. */
export function serverEnv(): ServerEnv {
  cached ??= serverSchema.parse(process.env);
  return cached;
}
