import { AppRoutes } from ".";
// RedisUtil.ts
import { createClient } from "redis";
import crypto from "crypto";

const redisClient = createClient({
  socket: {
    host: "localhost",
    port: 6379,
  },
  username: "default",
  password: process.env.REDIS_PASS,
});

redisClient.on("error", (err) => console.error("Redis Client Error:", err));

(async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Redis Connected Successfully");
  }
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
  try {
    const result = await redisClient.get(key);
    return result;
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
  try {
    await redisClient.set(key, value, {
      EX: ttlSeconds,
    });
  } catch (err) {
    console.error("Redis set error:", err);
  }
};
