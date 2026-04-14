import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Bookmark Add
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                     webhook                    
// BuildParams                        code                       
// UpsertBookmark                     postgres                   [creds]
// NotifySuccess                      httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger
//    → BuildParams
//      → UpsertBookmark
//        → NotifySuccess
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "SqMF4cQe0OmPs6CI",
    name: "Bookmark Add",
    active: true,
    settings: { executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false }
})
export class BookmarkAddWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "ba000001-0000-0000-0000-000000000001",
        webhookId: "ba000001-0000-0000-0000-000000000002",
        name: "Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        version: 1,
        position: [0, 0]
    })
    WebhookTrigger = {
        httpMethod: "POST",
        path: "bookmark-add",
        authentication: "none",
        options: {}
    };

    @node({
        id: "ba000001-0000-0000-0000-000000000005",
        name: "Build Params",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [240, 0]
    })
    BuildParams = {
        jsCode: `const body = $input.first().json.body ?? $input.first().json;
const { user_id, name, type, status } = body;
const progress = body.progress ?? null;
const notes = body.notes ?? null;
const e = v => v === null ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";
const query = \`INSERT INTO bookmarks (user_id, name, type, status, progress, notes)
VALUES (\${e(user_id)}, \${e(name)}, \${e(type)}, \${e(status)}, \${e(progress)}, \${e(notes)})
ON CONFLICT (user_id, name) DO UPDATE
  SET type = \${e(type)}, status = \${e(status)}, progress = \${e(progress)}, notes = \${e(notes)}, updated_at = NOW()
RETURNING id, name\`;
return [{ json: { query, name } }];`
    };

    @node({
        id: "ba000001-0000-0000-0000-000000000003",
        name: "Upsert Bookmark",
        type: "n8n-nodes-base.postgres",
        version: 2,
        position: [480, 0],
        credentials: {postgres:{id:"GsxlaCIusnApieKx",name:"Priestess"}}
    })
    UpsertBookmark = {
        operation: "executeQuery",
        query: "={{ $json.query }}",
        options: {}
    };

    @node({
        id: "ba000001-0000-0000-0000-000000000004",
        name: "Notify Success",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [720, 0]
    })
    NotifySuccess = {
        method: "POST",
        url: "http://host.docker.internal:3001/webhook",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: "Authorization",
                    value: "=Bearer ae9a28762250d7b72812114db22f52a3"
                },
                {
                    name: "Content-Type",
                    value: "application/json"
                }
            ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={
  "event": "bookmark.add.success",
  "via": "priestess",
  "message": "Bookmark '{{ $('Build Params').item.json.name }}' has been saved successfully."
}`,
        options: {
            timeout: 8000
        }
    };


    // =====================================================================
// ROUTAGE ET CONNEXIONS
// =====================================================================

    @links()
    defineRouting() {
        this.WebhookTrigger.out(0).to(this.BuildParams.in(0));
        this.BuildParams.out(0).to(this.UpsertBookmark.in(0));
        this.UpsertBookmark.out(0).to(this.NotifySuccess.in(0));
    }
}