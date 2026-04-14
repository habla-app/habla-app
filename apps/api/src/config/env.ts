import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  API_FOOTBALL_KEY: z.string().min(1),
  API_FOOTBALL_HOST: z.string().default("v3.football.api-sports.io"),
  CULQI_SECRET_KEY: z.string().optional(),
  CULQI_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
