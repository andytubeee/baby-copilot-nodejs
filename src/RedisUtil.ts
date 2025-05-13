import { AppRoutes } from ".";
import { createClient } from "redis";
import crypto from "crypto";

let redisReady = false;

const redisClient = createClient({
  socket: {
    host: "localhost",
    port: +(process.env.REDIS_PORT || 6379),
  },
  username: process.env.REDIS_USER,
  password: process.env.REDIS_PASS,
});

export const isRedisAvailable = async (): Promise<boolean> => {
  if (redisReady) return true;

  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    const response = await redisClient.ping();
    redisReady = response === "PONG";
    return redisReady;
  } catch (err) {
    console.warn("Redis not available. Caching disabled.");
    redisReady = false;
    return false;
  }
};

(async () => {
  await isRedisAvailable();
})();

export function getCacheKey(prefix: AppRoutes, rawInput: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(rawInput.trim())
    .digest("hex");
  return `${prefix}:${hash}`;
}

/**
 * Get cached value by key
 * @param key string
 * @returns Promise<string | null>
 */
export const getFromCache = async (key: string): Promise<string | null> => {
  if (!redisReady) return null;

  try {
    return await redisClient.get(key);
  } catch (err) {
    console.error("Redis get error:", err);
    return null;
  }
};

/**
 * Set value in cache with expiration
 * @param key string
 * @param value string
 * @param ttlSeconds number
 */
export const setInCache = async (
  key: string,
  value: string,
  ttlSeconds: number = 3600
): Promise<void> => {
  if (!redisReady) return;

  try {
    await redisClient.set(key, value, { EX: ttlSeconds });
  } catch (err) {
    console.error("Redis set error:", err);
  }
};
