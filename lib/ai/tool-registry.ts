import { z } from 'zod'

export type ToolExecutor<TInput, TOutput> = (input: TInput) => Promise<TOutput>

export interface ToolDefinition<TInput, TOutput> {
  name: string
  description: string
  schema: z.ZodType<TInput>
  execute: ToolExecutor<TInput, TOutput>
}

export function validateToolInput<TInput>(
  schema: z.ZodType<TInput>,
  input: unknown
): TInput {
  return schema.parse(input)
}
