import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Bookmark Update
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                     webhook                    
// BuildQuery                         code                       
// RunUpdate                          postgres                   [creds]
// NotifySuccess                      httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger
//    → BuildQuery
//      → RunUpdate
//        → NotifySuccess
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "rqWbRtbWnfc7CvHT",
    name: "Bookmark Update",
    active: true,
    settings: { executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false }
})
export class BookmarkUpdateWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "bu000002-0000-0000-0000-000000000001",
        webhookId: "bu000002-0000-0000-0000-000000000002",
        name: "Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        version: 1,
        position: [0, 0]
    })
    WebhookTrigger = {
        httpMethod: "POST",
        path: "bookmark-update",
        authentication: "none",
        options: {}
    };

    @node({
        id: "bu000002-0000-0000-0000-000000000003",
        name: "Build Query",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [240, 0]
    })
    BuildQuery = {
        jsCode: `const body = $input.first().json.body ?? $input.first().json;
const { user_id, name, progress, status, notes } = body;

const sets = [];
const vals = [user_id, name];

if (progress !== undefined && progress !== null) { sets.push('progress = $' + (vals.length + 1)); vals.push(progress); }
if (status !== undefined && status !== null)     { sets.push('status = $'   + (vals.length + 1)); vals.push(status); }
if (notes !== undefined && notes !== null)       { sets.push('notes = $'    + (vals.length + 1)); vals.push(notes); }

if (sets.length === 0) throw new Error('Nothing to update.');
sets.push('updated_at = NOW()');

const query = 'UPDATE bookmarks SET ' + sets.join(', ') + ' WHERE user_id = $1 AND name = $2 RETURNING name';
return [{ json: { query, vals, name } }];`
    };

    @node({
        id: "bu000002-0000-0000-0000-000000000004",
        name: "Run Update",
        type: "n8n-nodes-base.postgres",
        version: 2,
        position: [480, 0],
        credentials: {postgres:{id:"Wg9gdo6b0HeKl6is",name:"Report DB"}}
    })
    RunUpdate = {
        operation: "executeQuery",
        query: "={{ $json.query }}",
        options: {
            queryParams: "={{ JSON.stringify($json.vals) }}"
        }
    };

    @node({
        id: "bu000002-0000-0000-0000-000000000005",
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
  "event": "bookmark.update.success",
  "via": "priestess",
  "message": "Bookmark '{{ $('Build Query').item.json.name }}' has been updated."
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
        this.WebhookTrigger.out(0).to(this.BuildQuery.in(0));
        this.BuildQuery.out(0).to(this.RunUpdate.in(0));
        this.RunUpdate.out(0).to(this.NotifySuccess.in(0));
    }
}