import { defineEventHandler, readBody } from 'h3'
import { $fetch } from 'ofetch'

export default defineEventHandler(async (event) => {
  // Vercel環境では event.node.req.method を使う
  const method = event.method || event.node?.req?.method

  if (method !== 'POST') {
    return { status: "ok", message: "This endpoint is for POST requests only." }
  }

  const body = await readBody(event)

  // LINEの検証リクエストなど、eventsがない場合も200を返す
  const replyToken = body.events?.[0]?.replyToken
  const userMessage = body.events?.[0]?.message?.text

  if (!replyToken || !userMessage) return { status: "ok" }

  const replyMessage = {
    type: "text",
    text: `You said: "${userMessage}". This is a test response from your LINE bot!`
  }

  const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
  await $fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: {
      replyToken,
      messages: [replyMessage]
    }
  })

  return { status: "ok" }
})
  