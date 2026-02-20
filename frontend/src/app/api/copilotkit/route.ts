/**
 * CopilotKit Runtime Endpoint (single-route transport)
 *
 * Frontend `useSingleEndpoint` 설정과 짝을 맞춰
 * /api/copilotkit 단일 POST 엔드포인트로 agent run/info를 처리합니다.
 */

import { BuiltInAgent } from "@copilotkitnext/agent";
import {
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotEndpointSingleRoute,
} from "@copilotkitnext/runtime";

export const runtime = "nodejs";

const copilotRuntime = new CopilotRuntime({
  agents: {
    default: new BuiltInAgent({
      model: "openai/gpt-4o-mini",
      apiKey: process.env.OPENAI_API_KEY,
    }),
  },
  runner: new InMemoryAgentRunner(),
});

const app = createCopilotEndpointSingleRoute({
  runtime: copilotRuntime,
  basePath: "/api/copilotkit",
});

export async function POST(req: Request) {
  return app.fetch(req);
}
