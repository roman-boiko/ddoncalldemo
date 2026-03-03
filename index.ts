import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration({
  authMethods: {
    apiKeyAuth: Bun.env.DD_API_KEY,
    appKeyAuth: Bun.env.DD_APP_KEY,
  },
});

const eventsApi = new v2.EventsApi(configuration);


type AlertStatus = "ok" | "warn" | "error";
type AlertPriority = "1" | "2" | "3" | "4" | "5";

const SOURCE = "DemoOnCallApp";

interface PostEventOptions {
  title: string;
  message: string;
  status: AlertStatus;
  priority?: AlertPriority;
  host?: string;
  tags?: string[];
  aggregationKey?: string;
}

async function postEvent(options: PostEventOptions) {
  const response = await eventsApi.createEvent({
    body: {
      data: {
        type: "event",
        attributes: {
          title: options.title,
          message: options.message,
          category: "alert",
          host: options.host,
          tags: [`source:${SOURCE}`, ...(options.tags ?? [])],
          aggregationKey: options.aggregationKey,
          attributes: {
            status: options.status,
            priority: options.priority,
          },
        },
      },
    },
  });
  return response;
}

async function updateEvent(
  aggregationKey: string,
  status: AlertStatus,
  message: string,
  priority?: AlertPriority,
  extraTags?: string[],
) {
  return postEvent({
    title: `[Updated] Alert ${aggregationKey}`,
    message,
    status,
    priority,
    aggregationKey,
    tags: [`source:${SOURCE}`, ...(extraTags ?? [])],
  });
}


async function demo() {
  const runId = Math.floor(Math.random() * 1_000_000);
  console.log(`Run ID: ${runId}\n`);

  const teams = ["ResponderTeam1", "ResponderTeam2"];

  const events = ([
    { name: "cpu-spike", host: "web-server-01", metric: "CPU", value: "45%", priority: "1" as AlertPriority },
    { name: "mem-usage", host: "web-server-02", metric: "Memory", value: "60%", priority: "1" as AlertPriority },
    { name: "disk-io", host: "db-server-01", metric: "Disk I/O", value: "30%", priority: "2" as AlertPriority },
    { name: "net-latency", host: "web-server-03", metric: "Network Latency", value: "12ms", priority: "2" as AlertPriority },
    { name: "error-rate", host: "api-server-01", metric: "Error Rate", value: "0.5%", priority: "1" as AlertPriority },
    { name: "queue-depth", host: "worker-01", metric: "Queue Depth", value: "150", priority: "3" as AlertPriority },
    { name: "gc-pause", host: "app-server-01", metric: "GC Pause", value: "80ms", priority: "3" as AlertPriority },
    { name: "conn-pool", host: "db-server-02", metric: "Connection Pool", value: "40%", priority: "2" as AlertPriority },
    { name: "swap-usage", host: "web-server-04", metric: "Swap Usage", value: "10%", priority: "4" as AlertPriority },
    { name: "thread-count", host: "api-server-02", metric: "Thread Count", value: "200", priority: "5" as AlertPriority },
  ]).map((e, i) => ({ ...e, aggKey: `${e.name}-${runId}`, team: teams[i % 2] }));

  // Create events with ok status
  console.log("--- Creating events with OK status ---");
  for (const evt of events) {
    const res = await postEvent({
      title: `[Demo] ${evt.metric} check on ${evt.host}`,
      message: `${evt.metric} is at ${evt.value} on ${evt.host} — within normal range.`,
      status: "ok",
      priority: evt.priority,
      host: evt.host,
      tags: ["env:demo", "service:oncall-demo", `team:${evt.team}`],
      aggregationKey: evt.aggKey,
    });
    console.log(`Created: ${evt.aggKey} (ok, P${evt.priority}, ${evt.team}) ->`, res.data?.type);
  }

  console.log("\nWaiting 10s before updating...\n");
  await Bun.sleep(10000);

  // Update the same events to error status
  console.log("--- Updating events to ERROR status ---");
  for (const evt of events) {
    const res = await updateEvent(
      evt.aggKey,
      "error",
      `${evt.metric} has exceeded critical threshold on ${evt.host}!`,
      evt.priority,
      [`team:${evt.team}`],
    );
    console.log(`Updated: ${evt.aggKey} (error, P${evt.priority}, ${evt.team}) ->`, res.data?.type);
  }

  console.log("\nWaiting 10s before resolving...\n");
  await Bun.sleep(10000);

  // Resolve 75% of events (first 7 out of 10) back to ok
  const toResolve = events.slice(0, Math.ceil(events.length * 0.75));
  const unresolved = events.slice(Math.ceil(events.length * 0.75));

  console.log("--- Resolving 75% of events back to OK ---");
  for (const [i, evt] of toResolve.entries()) {
    if (i > 0) await Bun.sleep(5000);
    const res = await updateEvent(
      evt.aggKey,
      "ok",
      `${evt.metric} on ${evt.host} has returned to normal levels.`,
      evt.priority,
      [`team:${evt.team}`],
    );
    console.log(`Resolved: ${evt.aggKey} (ok, P${evt.priority}, ${evt.team}) ->`, res.data?.type);
  }

  console.log("\n--- Still in ERROR ---");
  for (const evt of unresolved) {
    console.log(`  ${evt.name} (P${evt.priority}, ${evt.team}) - ${evt.metric} on ${evt.host}`);
  }

}

demo().catch(console.error);
