import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Bookmark Add
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name   Node type (short)   Flags
// WebhookTrigger    webhook             [creds]
// BuildParams       code
// UpsertBookmark    postgres            [creds]
// RespondOk         respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger → BuildParams → UpsertBookmark → RespondOk
// </workflow-map>

@workflow({
  id: 'REPLACE_AFTER_IMPORT_1',
  name: 'bookmark-add',
  active: true,
  settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class BookmarkAddWorkflow {

  @node({
    id: 'ba000001-0000-0000-0000-000000000001',
    webhookId: 'ba000001-0000-0000-0000-000000000002',
    name: 'Webhook Trigger',
    type: 'n8n-nodes-base.webhook',
    version: 1,
    position: [0, 0],
    credentials: { httpBasicAuth: { id: 's7dUrGqut3lG9PMW', name: 'Overlord' } },
  })
  WebhookTrigger = {
    httpMethod: 'POST',
    path: 'bookmark-add',
    authentication: 'basicAuth',
    options: { responseData: 'json' },
  };

  @node({
    id: 'ba000001-0000-0000-0000-000000000005',
    name: 'Build Params',
    type: 'n8n-nodes-base.code',
    version: 2,
    position: [240, 0],
  })
  BuildParams = {
    jsCode: `const body = $input.first().json.body ?? $input.first().json;
const { user_id, name, type, status, progress, notes } = body;
return [{
  json: {
    query: \`INSERT INTO bookmarks (user_id, name, type, status, progress, notes)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, name) DO UPDATE
  SET type = $3, status = $4, progress = $5, notes = $6, updated_at = NOW()
RETURNING id, name\`,
    vals: [user_id, name, type, status, progress ?? null, notes ?? null],
  }
}];`,
  };

  @node({
    id: 'ba000001-0000-0000-0000-000000000003',
    name: 'Upsert Bookmark',
    type: 'n8n-nodes-base.postgres',
    version: 2,
    position: [480, 0],
    credentials: { postgres: { id: 'Wg9gdo6b0HeKl6is', name: 'Report DB' } },
  })
  UpsertBookmark = {
    operation: 'executeQuery',
    query: '={{ $json.query }}',
    options: {
      queryParams: '={{ JSON.stringify($json.vals) }}',
    },
  };

  @node({
    id: 'ba000001-0000-0000-0000-000000000004',
    name: 'Respond Ok',
    type: 'n8n-nodes-base.respondToWebhook',
    version: 1,
    position: [720, 0],
  })
  RespondOk = {
    respondWith: 'json',
    responseBody: '={{ JSON.stringify({ ok: true, name: $("Upsert Bookmark").item.json.name }) }}',
    options: {},
  };

  @links()
  defineRouting() {
    this.WebhookTrigger.out(0).to(this.BuildParams.in(0));
    this.BuildParams.out(0).to(this.UpsertBookmark.in(0));
    this.UpsertBookmark.out(0).to(this.RespondOk.in(0));
  }
}
