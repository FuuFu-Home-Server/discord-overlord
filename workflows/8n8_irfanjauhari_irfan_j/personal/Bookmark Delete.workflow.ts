import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Bookmark Delete
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                     webhook                    
// BuildParams                        code                       
// DeleteBookmark                     postgres                   [creds]
// NotifySuccess                      httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger
//    → BuildParams
//      → DeleteBookmark
//        → NotifySuccess
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "PbCFGth59MG5opcr",
    name: "Bookmark Delete",
    active: true,
    settings: { executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false }
})
export class BookmarkDeleteWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "bd000003-0000-0000-0000-000000000001",
        webhookId: "bd000003-0000-0000-0000-000000000002",
        name: "Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        version: 1,
        position: [0, 0]
    })
    WebhookTrigger = {
        httpMethod: "POST",
        path: "bookmark-delete",
        authentication: "none",
        options: {}
    };

    @node({
        id: "bd000003-0000-0000-0000-000000000005",
        name: "Build Params",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [240, 0]
    })
    BuildParams = {
        jsCode: `const body = $input.first().json.body ?? $input.first().json;
return [{ json: { query: 'DELETE FROM bookmarks WHERE user_id = $1 AND name = $2 RETURNING name', vals: [body.user_id, body.name], name: body.name } }];`
    };

    @node({
        id: "bd000003-0000-0000-0000-000000000003",
        name: "Delete Bookmark",
        type: "n8n-nodes-base.postgres",
        version: 2,
        position: [480, 0],
        credentials: {postgres:{id:"Wg9gdo6b0HeKl6is",name:"Report DB"}}
    })
    DeleteBookmark = {
        operation: "executeQuery",
        query: "={{ $json.query }}",
        options: {
            queryParams: "={{ JSON.stringify($json.vals) }}"
        }
    };

    @node({
        id: "bd000003-0000-0000-0000-000000000004",
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
  "event": "bookmark.delete.success",
  "via": "priestess",
  "message": "Bookmark '{{ $('Build Params').item.json.name }}' has been deleted."
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
        this.BuildParams.out(0).to(this.DeleteBookmark.in(0));
        this.DeleteBookmark.out(0).to(this.NotifySuccess.in(0));
    }
}