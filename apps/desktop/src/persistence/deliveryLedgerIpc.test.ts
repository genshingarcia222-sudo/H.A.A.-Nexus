import { describe, expect, it, vi } from "vitest";
import type { DeliveryEvent } from "@haa-nexus/nexus-core";
import { DeliveryEventSchema } from "@haa-nexus/nexus-core";
import deliveryEventFixture from "../../ipc-contract/delivery-event.json";

/**
 * The exposure ledger across IPC (D12 work package 8).
 *
 * Two things are pinned: the shared fixture really is a valid `DeliveryEvent`,
 * so the Rust DTO and the TypeScript type cannot drift apart silently; and the
 * client sends the parameter names the Rust commands expect, which is the kind
 * of mistake that fails only at runtime with an `undefined` field.
 */

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { TauriDeliveryEventRepository } = await import("./tauriDeliveryEventRepository.js");

const event = DeliveryEventSchema.parse(deliveryEventFixture);

describe("the shared fixture is the contract", () => {
  it("parses as a DeliveryEvent", () => {
    expect(event.deliveryId).toBe(deliveryEventFixture.deliveryId);
    expect(event.population).toBe("practice");
    expect(event.trace.reasons.length).toBeGreaterThan(0);
  });

  it("carries a pseudonymous learner reference, not a person's name", () => {
    expect(event.learnerRef).toMatch(/^learner-/);
    // An address, not any "@": policy and envelope ids are pinned as
    // "training.default@1", which is a version, not a mailbox.
    expect(JSON.stringify(deliveryEventFixture)).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(JSON.stringify(deliveryEventFixture)).not.toMatch(/email|firstName|lastName|fullName/i);
  });
});

describe("the client speaks the commands' language", () => {
  it("appends under the parameter name the command declares", async () => {
    invoke.mockReset().mockResolvedValue(undefined);
    await new TauriDeliveryEventRepository().append(event);
    expect(invoke).toHaveBeenCalledWith("append_delivery_event", { event });
  });

  it("records an answer with camelCase keys Tauri maps to snake_case params", async () => {
    invoke.mockReset().mockResolvedValue(true);
    await new TauriDeliveryEventRepository().recordAnswer("D-1", {
      answeredChoiceId: "a",
      correct: true,
      answeredAt: "2026-09-25T09:00:30Z"
    });
    expect(invoke).toHaveBeenCalledWith("record_delivery_answer", {
      deliveryId: "D-1",
      answeredChoiceId: "a",
      correct: true,
      answeredAt: "2026-09-25T09:00:30Z"
    });
  });

  it("reports rather than silently succeeding when an answer is refused", async () => {
    // The command returns false for an unknown or already-answered delivery.
    invoke.mockReset().mockResolvedValue(false);
    await expect(
      new TauriDeliveryEventRepository().recordAnswer("D-1", {
        answeredChoiceId: "a",
        correct: true,
        answeredAt: "2026-09-25T09:00:30Z"
      })
    ).rejects.toThrow(/unknown or already answered/);
  });

  it("reads a session's deliveries by session, and a learner's by learner", async () => {
    invoke.mockReset().mockResolvedValue([deliveryEventFixture]);
    const repository = new TauriDeliveryEventRepository();

    await repository.find({ sessionId: "run-1" });
    expect(invoke).toHaveBeenCalledWith("list_deliveries_for_session", { sessionId: "run-1" });

    await repository.find({ learnerRef: "learner-7f3a", since: "2026-09-01" });
    expect(invoke).toHaveBeenCalledWith("list_deliveries_for_learner", {
      learnerRef: "learner-7f3a",
      since: "2026-09-01"
    });
  });

  it("refuses an unscoped read rather than scanning the whole ledger", async () => {
    invoke.mockReset();
    await expect(new TauriDeliveryEventRepository().find({})).rejects.toThrow(/learnerRef or a sessionId/);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("passes an empty result through as an empty list", async () => {
    invoke.mockReset().mockResolvedValue([]);
    await expect(new TauriDeliveryEventRepository().find({ sessionId: "empty" })).resolves.toEqual([]);
  });

  it("lets a failing command propagate rather than swallowing it", async () => {
    invoke.mockReset().mockRejectedValue(new Error("Database error: constraint failed"));
    await expect(new TauriDeliveryEventRepository().append(event)).rejects.toThrow(/Database error/);
  });
});
