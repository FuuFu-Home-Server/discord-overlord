import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : List Calendar Events
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookTrigger                     webhook                    
// GetEvents                          googleCalendar             [creds]
// FormatList                         code                       
// NotifyList                         httpRequest                
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookTrigger
//    → GetEvents
//      → FormatList
//        → NotifyList
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: "gPuCSav4RgEfLmlx",
    name: "List Calendar Events",
    active: false,
    settings: { executionOrder: "v1", callerPolicy: "workflowsFromSameOwner", availableInMCP: false }
})
export class ListCalendarEventsWorkflow {

    // =====================================================================
// CONFIGURATION DES NOEUDS
// =====================================================================

    @node({
        id: "d4000001-0000-0000-0000-000000000001",
        webhookId: "d4000001-0000-0000-0000-000000000002",
        name: "Webhook Trigger",
        type: "n8n-nodes-base.webhook",
        version: 1,
        position: [0, 0]
    })
    WebhookTrigger = {
        httpMethod: "POST",
        path: "list-calendar-events",
        authentication: "none",
        options: {
            responseData: "json"
        }
    };

    @node({
        id: "d4000001-0000-0000-0000-000000000003",
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
            timeMin: "={{ new Date().toISOString() }}",
            timeMax: "={{ new Date(Date.now() + (($('Webhook Trigger').item.json.body?.days ?? $('Webhook Trigger').item.json.days ?? 7)) * 86400000).toISOString() }}",
            singleEvents: true,
            orderBy: "startTime"
        }
    };

    @node({
        id: "d4000001-0000-0000-0000-000000000004",
        name: "Format List",
        type: "n8n-nodes-base.code",
        version: 2,
        position: [480, 0]
    })
    FormatList = {
        jsCode: `const wb = $('Webhook Trigger').item.json;
const body = wb.body ?? wb;
const days = body.days ?? 7;
const items = $input.all().filter(i => i.json.id);

if (items.length === 0) {
  return [{ json: { event: 'calendar.events.list', via: 'priestess', message: \`No events in the next \${days} day\${days !== 1 ? 's' : ''}.\` } }];
}

const lines = items.map(item => {
  const startRaw = item.json.start?.dateTime ?? item.json.start?.date;
  const isAllDay = !item.json.start?.dateTime;
  const start = isAllDay
    ? new Date(startRaw).toLocaleDateString('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', month: 'short', day: 'numeric' })
    : new Date(startRaw).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const title = item.json.summary ?? 'Untitled';
  const loc = item.json.location ? \` @ \${item.json.location}\` : '';
  return \`- \${start}: \${title}\${loc}\`;
});

return [{ json: { event: 'calendar.events.list', via: 'priestess', message: \`Upcoming events (next \${days} day\${days !== 1 ? 's' : ''}):\\n\${lines.join('\\n')}\` } }];`
    };

    @node({
        id: "d4000001-0000-0000-0000-000000000005",
        name: "Notify List",
        type: "n8n-nodes-base.httpRequest",
        version: 4,
        position: [720, 0]
    })
    NotifyList = {
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
                    value: "={{ $json.event }}"
                },
                {
                    name: "via",
                    value: "={{ $json.via }}"
                },
                {
                    name: "message",
                    value: "={{ $json.message }}"
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
        this.GetEvents.out(0).to(this.FormatList.in(0));
        this.FormatList.out(0).to(this.NotifyList.in(0));
    }
}