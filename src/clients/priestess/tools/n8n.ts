import { executeTriggerWorkflow } from '@/clients/n8n-executor'

export async function handleTriggerN8nWorkflow(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  return executeTriggerWorkflow(
    String(args.name),
    args.payload as Record<string, unknown> | undefined,
    process.env.N8N_WEBHOOK_SECRET ?? '',
  )
}
