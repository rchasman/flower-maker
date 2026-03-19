export async function handleOrder(request: Request) {
  const body = await request.json() as {
    session_id: number;
    spec: unknown;
    arrangement_level: string;
    flower_count: number;
    generation: number;
    prompt: string;
  };

  const orderPayload = {
    api_version: "v1",
    order: {
      session_id: body.session_id,
      arrangement: {
        spec: body.spec,
        level: body.arrangement_level,
        flower_count: body.flower_count,
        prompt: body.prompt,
      },
      metadata: {
        generation: body.generation,
        created_at: new Date().toISOString(),
      },
    },
  };

  return Response.json(orderPayload);
}
