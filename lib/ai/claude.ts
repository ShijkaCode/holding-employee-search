import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam, Tool, ContentBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages'

let client: Anthropic | null = null

export function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured')
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'

export type { MessageParam, Tool, ContentBlock, ToolResultBlockParam }
