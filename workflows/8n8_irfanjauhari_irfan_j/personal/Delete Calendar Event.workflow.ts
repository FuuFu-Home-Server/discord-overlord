import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Delete Calendar Event
// Nodes   : 6  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                     webhook                    
// GetEvents                          googleCalendar             [creds]
// FindMatch                          code                       [onError→out(1)]
// UpdateEvent                        googleCalendar             [creds]
// NotifySuccess                      httpRequest                
// NotifyFailure                      httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger
//    → GetEvents
//      → FindMatch
//        → UpdateEvent
//          → NotifySuccess
//        → NotifyFailure
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "F2VPnuJaEeqNv9cs",
    name: "Delete Calendar Event",
    active: false,
    settings: { executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false }
})
export class DeleteCalendarEventWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "e5000001-0000-0000-0000-000000000001",
        webhookId: "e5000001-0000-0000-0000-000000000002",
        name: "Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        version: 1,
        position: [0, 0]
    })
    WebhookTrigger = {
        httpMethod: "POST",
        path: "delete-calendar-event",
        authentication: "none",
        options: {
            responseData: "json"
        }
    };

    @node({
        id: "e5000001-0000-0000-0000-000000000003",
        name: "Get Events",
        type: "n8n-nodes-base.googleCalendar",
        version: 1,
        position: [240, 0],
        credentials: {googleCalendarOAuth2Api:{id:"sjkY1KJUq4GeoDH6",name:"Google Calendar account"}}
    })
    GetEvents = {
        operation: "getAll",
        calendar: {
            __rl: true,
            value: "primary",
            mode: "list",
            cachedResultName: "Primary"
        },
        returnAll: true,
        options: {
            timeMin: "={{ new Date(Date.now() - 3600000).toISOString() }}",
            timeMax: "={{ new Date(Date.now() + 30 * 86400000).toISOString() }}",
            singleEvents: true,
            orderBy: "startTime"
        }
    };

    @node({
        id: "e5000001-0000-0000-0000-000000000004",
        name: "Find Match",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [480, 0],
        onError: "continueErrorOutput"
    })
    FindMatch = {
        jsCode: `const wb = $('Webhook Trigger').item.json;
const body = wb.body ?? wb;
const searchTitle = (body.title ?? '').toLowerCase().trim();
const searchDate = body.date ? new Date(body.date).toDateString() : null;
const status = (body.status ?? 'cancel').toLowerCase();

if (!searchTitle) throw new Error('No title provided.');

const items = $input.all().filter(i => i.json.id);
const match = items.find(item => {
  const title = (item.json.summary ?? '').toLowerCase().replace(/^\\[(done|canceled)\\]\\s*/, '');
  if (!title.includes(searchTitle)) return false;
  if (searchDate) {
    const eventDate = new Date(item.json.start?.dateTime ?? item.json.start?.date).toDateString();
    return eventDate === searchDate;
  }
  return true;
});

if (!match) throw new Error(\`No upcoming event found matching "\${body.title}".\`);

const prefix = status === 'done' ? '[DONE] ' : '[CANCELED] ';
const currentTitle = match.json.summary ?? '';
const cleanTitle = currentTitle.replace(/^\\[(DONE|CANCELED)\\]\\s*/, '');
const newTitle = prefix + cleanTitle;

return [{ json: { eventId: match.json.id, originalTitle: currentTitle, newTitle, status } }];`
    };

    @node({
        id: "e5000001-0000-0000-0000-000000000005",
        name: "Update Event",
        type: "n8n-nodes-base.googleCalendar",
        version: 1,
        position: [720, -80],
        credentials: {googleCalendarOAuth2Api:{id:"sjkY1KJUq4GeoDH6",name:"Google Calendar account"}}
    })
    UpdateEvent = {
        operation: "update",
        calendar: {
            __rl: true,
            value: "primary",
            mode: "list",
            cachedResultName: "Primary"
        },
        eventId: "={{ $json.eventId }}",
        updateFields: {
            summary: "={{ $json.newTitle }}"
        }
    };

    @node({
        id: "e5000001-0000-0000-0000-000000000006",
        name: "Notify Success",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [960, -80]
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
        specifyBody: "keypair",
        bodyParameters: {
            parameters: [
                {
                    name: "event",
                    value: "calendar.event.updated"
                },
                {
                    name: "via",
                    value: "priestess"
                },
                {
                    name: "message",
                    value: "={{ '\"' + $('Find Match').item.json.originalTitle + '\" marked as ' + $('Find Match').item.json.status + '.' }}"
                }
            ]
        },
        options: {
            timeout: 8000
        }
    };

    @node({
        id: "e5000001-0000-0000-0000-000000000007",
        name: "Notify Failure",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [720, 80]
    })
    NotifyFailure = {
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
        specifyBody: "keypair",
        bodyParameters: {
            parameters: [
                {
                    name: "event",
                    value: "calendar.event.update_failed"
                },
                {
                    name: "via",
                    value: "priestess"
                },
                {
                    name: "message",
                    value: "={{ $json.error?.message ?? $json.message ?? 'Could not find the event.' }}"
                }
            ]
        },
        options: {
            timeout: 8000
        }
    };


    // =====================================================================
// ROUTAGE ET CONNEXIONS
// =====================================================================

    @links()
    defineRouting() {
        this.WebhookTrigger.out(0).to(this.GetEvents.in(0));
        this.GetEvents.out(0).to(this.FindMatch.in(0));
        this.FindMatch.out(0).to(this.UpdateEvent.in(0));
        this.FindMatch.error().to(this.NotifyFailure.in(0));
        this.UpdateEvent.out(0).to(this.NotifySuccess.in(0));
    }
}