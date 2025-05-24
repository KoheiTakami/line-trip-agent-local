import { Configuration, OpenAIApi } from "openai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ step: 'method check', message: 'Method Not Allowed' });
  }

  // 受け取ったリクエストボディ全体をそのまま返す（デバッグ用）
  return res.status(200).json({ step: 'debug', body: req.body });
} 