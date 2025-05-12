import express, { Request, Response } from "express";
import { getCacheKey, getFromCache, setInCache } from "./RedisUtil";

import { OpenAI } from "openai";
import dotenv from "dotenv";
import prompts from "../assets/prompts.json";

dotenv.config();

const app = express();
app.use(express.json());

const MAX_TOKEN = 1200;
const MAX_COMPLETION_TOKENS = MAX_TOKEN - 50;
const STOP_INDICATORS = ["<end>"];

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

const client = new OpenAI({ apiKey: OPENAI_KEY });

export type AppRoutes =
  | "completion"
  | "explain"
  | "comment"
  | "obfus"
  | "suggest";

interface RouteOptions {
  routeName: AppRoutes;
  inputField: string;
  responseField: string;
  model?: string;
  maxTokens?: number;
  stop?: string[];
}

function resolvePrompt(route: AppRoutes): string {
  let prompt = prompts[route];
  if (route === "explain") {
    prompt = prompt.replace(
      "MAX_COMPLETION_TOKENS",
      MAX_COMPLETION_TOKENS.toString()
    );
  }
  return prompt;
}

async function handleRoute(
  req: Request,
  res: Response,
  options: RouteOptions
): Promise<void> {
  const {
    routeName,
    inputField,
    responseField,
    model = "gpt-4o-mini",
    maxTokens = MAX_TOKEN,
    stop = STOP_INDICATORS,
  } = options;

  const input = req.body[inputField];
  if (typeof input !== "string" || input.trim().length === 0) {
    res
      .status(400)
      .json({ error: `Missing or empty \`${inputField}\` field.` });
    return;
  }

  const cacheKey = getCacheKey(routeName, input);
  const cached = await getFromCache(cacheKey);

  if (cached) {
    console.log(`✅ [${routeName}] Cache hit:`, cacheKey);
    res.json({ [responseField]: cached });
    return;
  }

  const systemPrompt = resolvePrompt(routeName);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ],
      max_tokens: maxTokens,
      stop,
    });

    const result = response.choices?.[0]?.message?.content ?? "";
    console.log(`📩 [${routeName}] Response:`, result);

    await setInCache(cacheKey, result, 3600);
    res.json({ [responseField]: result });
  } catch (err: any) {
    console.error(
      `❌ OpenAI API error in /${routeName}:`,
      err.response?.data || err.message
    );
    res.status(500).json({ error: `Failed to process ${routeName}.` });
  }
}

// Register routes
app.post("/completions", (req, res) =>
  handleRoute(req, res, {
    routeName: "completion",
    inputField: "instruction",
    responseField: "completion",
  })
);

app.post("/explain", (req, res) =>
  handleRoute(req, res, {
    routeName: "explain",
    inputField: "code",
    responseField: "explanation",
  })
);

app.post("/comment", (req, res) =>
  handleRoute(req, res, {
    routeName: "comment",
    inputField: "code",
    responseField: "commented_code",
  })
);

app.post("/obfus", (req, res) =>
  handleRoute(req, res, {
    routeName: "obfus",
    inputField: "code",
    responseField: "obfus",
  })
);

app.post("/suggest", (req, res) =>
  handleRoute(req, res, {
    routeName: "suggest",
    inputField: "code_context",
    responseField: "suggestion",
    maxTokens: 100,
  })
);

// Start server
const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
});
