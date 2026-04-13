import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Bookmark Delete
// Nodes   : 3  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name    Node type (short)   Flags
// WebhookTrigger     webhook             [creds]
// DeleteBookmark     postgres            [creds]
// RespondOk          respondToWebhook
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger → DeleteBookmark → RespondOk
// </workflow-map>

@workflow({
  id: 'REPLACE_AFTER_IMPORT_3',
  name: 'bookmark-delete',
  active: true,
  settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class BookmarkDeleteWorkflow {

  @node({
    id: 'bd000003-0000-0000-0000-000000000001',
    webhookId: 'bd000003-0000-0000-0000-000000000002',
    name: 'Webhook Trigger',
    type: 'n8n-nodes-base.webhook',
    version: 1,
    position: [0, 0],
    credentials: { httpBasicAuth: { id: 's7dUrGqut3lG9PMW', name: 'Overlord' } },
  })
  WebhookTrigger = {
    httpMethod: 'POST',
    path: 'bookmark-delete',
    authentication: 'basicAuth',
    options: { responseData: 'json' },
  };

  @node({
    id: 'bd000003-0000-0000-0000-000000000003',
    name: 'Delete Bookmark',
    type: 'n8n-nodes-base.postgres',
    version: 2,
    position: [240, 0],
    credentials: { postgres: { id: 'Wg9gdo6b0HeKl6is', name: 'Report DB' } },
  })
  DeleteBookmark = {
    operation: 'executeQuery',
    query: `DELETE FROM bookmarks WHERE user_id = '{{ $json.body.user_id }}' AND name = '{{ $json.body.name }}' RETURNING name;`,
    options: {},
  };

  @node({
    id: 'bd000003-0000-0000-0000-000000000004',
    name: 'Respond Ok',
    type: 'n8n-nodes-base.respondToWebhook',
    version: 1,
    position: [480, 0],
  })
  RespondOk = {
    respondWith: 'json',
    responseBody: '={{ JSON.stringify({ ok: true }) }}',
    options: {},
  };

  @links()
  defineRouting() {
    this.WebhookTrigger.out(0).to(this.DeleteBookmark.in(0));
    this.DeleteBookmark.out(0).to(this.RespondOk.in(0));
  }
}
