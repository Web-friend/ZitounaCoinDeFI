export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "ZitounaDeFi API",
    version: "0.1.0",
    description:
      "Tokenized Tunisian olive oil on Hedera. Certify a lot, sell fractional litres for tUSDT, transfer, redeem and burn, with a browser-verifiable reserve agent.",
  },
  servers: [{ url: "/api/v1", description: "Current server" }],
  tags: [
    { name: "Lots", description: "Lot passport, attestations, listings and sales" },
    { name: "Redemptions", description: "Physical pickup flow" },
    { name: "Wallets", description: "Demo accounts and balances" },
    { name: "Mirror", description: "Mirror-Node-shaped reads for the public passport" },
    { name: "Demo", description: "Seed, reset and judge-facing fault injection" },
    { name: "System", description: "Health and configuration" },
  ],
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object", nullable: true },
              requestId: { type: "string" },
            },
          },
        },
      },
      Lot: {
        type: "object",
        properties: {
          id: { type: "string", example: "LOT-0001" },
          series: { type: "string", enum: ["DGZ", "TZT"] },
          status: { type: "string", enum: ["BACKED", "LOW_STOCK", "UNDERBACKED", "STALE", "INVALID"] },
          litres: { type: "object" },
          price: { type: "object" },
          supply: { type: "object" },
          topicId: { type: "string" },
          nft: { type: "object" },
          attestations: { type: "array", items: { type: "object" } },
          agent: { type: "object" },
        },
      },
    },
    parameters: {
      lotId: { name: "id", in: "path", required: true, schema: { type: "string" }, example: "LOT-0001" },
      redemptionId: { name: "id", in: "path", required: true, schema: { type: "string" } },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Database and ledger health",
        responses: { "200": { description: "OK" } },
      },
    },
    "/lots": {
      get: {
        tags: ["Lots"],
        summary: "List lots with live reserve state",
        responses: { "200": { description: "Lot list" } },
      },
      post: {
        tags: ["Lots"],
        summary: "Create a lot, its HCS topic and its NFT passport",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["series"],
                properties: {
                  series: { type: "string", enum: ["DGZ", "TZT"] },
                  certifiedLitres: { type: "integer", example: 10000 },
                  pricePerLitreCents: { type: "integer", example: 420 },
                  grade: { type: "string", example: "extra_virgin" },
                  warehouse: { type: "string" },
                  harvestYear: { type: "integer", example: 2026 },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" } },
      },
    },
    "/lots/{id}": {
      get: {
        tags: ["Lots"],
        summary: "Full lot passport, attestations, agent and activity",
        parameters: [{ $ref: "#/components/parameters/lotId" }],
        responses: { "200": { description: "Lot" }, "404": { description: "Not found" } },
      },
    },
    "/lots/{id}/attest": {
      post: {
        tags: ["Lots"],
        summary: "Submit an auditor-signed stock attestation",
        parameters: [{ $ref: "#/components/parameters/lotId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  recordText: { type: "string" },
                  signature: { type: "string" },
                  litresRemaining: { type: "integer" },
                  labHash: { type: "string" },
                  receiptHash: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Attested" } },
      },
    },
    "/lots/{id}/next-attestation": {
      get: {
        tags: ["Lots"],
        summary: "Next sequence number and previous chain hash for the auditor tool",
        parameters: [{ $ref: "#/components/parameters/lotId" }],
        responses: { "200": { description: "Attestation context" } },
      },
    },
    "/lots/{id}/list": {
      post: {
        tags: ["Lots"],
        summary: "Post the primary-sale price and litres on offer",
        parameters: [{ $ref: "#/components/parameters/lotId" }],
        responses: { "200": { description: "Listed" } },
      },
    },
    "/lots/{id}/buy": {
      post: {
        tags: ["Lots"],
        summary: "Atomic tUSDT-for-token purchase",
        parameters: [{ $ref: "#/components/parameters/lotId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["accountId", "idempotencyKey"],
                properties: {
                  accountId: { type: "string" },
                  litresMl: { type: "integer", example: 12500 },
                  tokensCt: { type: "integer", example: 125 },
                  idempotencyKey: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Sale settled" }, "409": { description: "Reserve or balance rejected" } },
      },
    },
    "/lots/{id}/transfer": {
      post: {
        tags: ["Lots"],
        summary: "Peer-to-peer token transfer",
        parameters: [{ $ref: "#/components/parameters/lotId" }],
        responses: { "201": { description: "Transferred" } },
      },
    },
    "/lots/{id}/agent-check": {
      post: {
        tags: ["Lots"],
        summary: "Run the reserve agent and write its verdict to HCS",
        parameters: [{ $ref: "#/components/parameters/lotId" }],
        responses: { "200": { description: "Verdict" } },
      },
    },
    "/lots/{id}/stream": {
      get: {
        tags: ["Lots"],
        summary: "Server-sent events for live lot updates",
        parameters: [{ $ref: "#/components/parameters/lotId" }],
        responses: { "200": { description: "text/event-stream" } },
      },
    },
    "/redemptions": {
      get: {
        tags: ["Redemptions"],
        summary: "List redemptions",
        parameters: [{ name: "accountId", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Redemptions" } },
      },
      post: {
        tags: ["Redemptions"],
        summary: "Lock tokens in the treasury and open a pickup",
        responses: { "201": { description: "Redemption requested" } },
      },
    },
    "/redemptions/{id}": {
      get: {
        tags: ["Redemptions"],
        summary: "Redemption tracker state",
        parameters: [{ $ref: "#/components/parameters/redemptionId" }],
        responses: { "200": { description: "Redemption" } },
      },
    },
    "/redemptions/{id}/handover": {
      post: {
        tags: ["Redemptions"],
        summary: "Signed handover, then burn",
        parameters: [{ $ref: "#/components/parameters/redemptionId" }],
        responses: { "200": { description: "Burned" } },
      },
    },
    "/redemptions/{id}/return": {
      post: {
        tags: ["Redemptions"],
        summary: "Return tokens after a missed deadline",
        parameters: [{ $ref: "#/components/parameters/redemptionId" }],
        responses: { "200": { description: "Returned" } },
      },
    },
    "/accounts": {
      get: {
        tags: ["Wallets"],
        summary: "Demo account switcher",
        responses: { "200": { description: "Accounts" } },
      },
    },
    "/wallets/{ref}": {
      get: {
        tags: ["Wallets"],
        summary: "Balances and activity for an account",
        parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Wallet" } },
      },
    },
    "/mirror/topics/{topicId}/messages": {
      get: {
        tags: ["Mirror"],
        summary: "Mirror-Node-shaped HCS messages, used by the browser passport",
        parameters: [{ name: "topicId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Messages" } },
      },
    },
    "/mirror/tokens/{tokenId}": {
      get: {
        tags: ["Mirror"],
        summary: "Token supply and metadata",
        parameters: [{ name: "tokenId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Token" } },
      },
    },
    "/demo/state": {
      get: {
        tags: ["Demo"],
        summary: "Accounts, tokens, lots and policy for the demo panel",
        responses: { "200": { description: "State" } },
      },
    },
    "/demo/reset": {
      post: {
        tags: ["Demo"],
        summary: "Burn demo supply, archive lots, create fresh buyers and reseed",
        responses: { "200": { description: "Reset" } },
      },
    },
    "/demo/underbacked": {
      post: {
        tags: ["Demo"],
        summary: "Submit an attestation below supply and flip the lot to UNDERBACKED",
        responses: { "200": { description: "Fault injected" } },
      },
    },
    "/demo/stale": {
      post: {
        tags: ["Demo"],
        summary: "Shrink the attestation freshness window and re-run the agent",
        responses: { "200": { description: "Stale window set" } },
      },
    },
    "/demo/pause": {
      post: {
        tags: ["Demo"],
        summary: "Operator pause switch for minting",
        responses: { "200": { description: "Paused state" } },
      },
    },
  },
};
