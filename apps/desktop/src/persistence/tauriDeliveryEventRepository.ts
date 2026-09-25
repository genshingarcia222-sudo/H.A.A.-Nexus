import { invoke } from "@tauri-apps/api/core";
import type { AsyncDeliveryEventRepository, DeliveryEvent, DeliveryEventQuery } from "@haa-nexus/nexus-core";

/**
 * The exposure ledger, over IPC (D12 work package 8).
 *
 * The `DeliveryEventRepository` contract is append-only, and so is this: there
 * is no command to edit or delete a delivery, and `recordAnswer` fills an
 * answer exactly once. Where the in-memory adapter throws, this throws the
 * same way, so a caller cannot tell the two apart by behaviour — which is what
 * makes the in-memory tests meaningful for the durable path too.
 *
 * Reads are scoped to one learner or one session. A single install has no view
 * of anyone else's history, and this interface offers no way to ask for one.
 */
export class TauriDeliveryEventRepository implements AsyncDeliveryEventRepository {
  async append(event: DeliveryEvent): Promise<void> {
    await invoke("append_delivery_event", { event });
  }

  async recordAnswer(
    deliveryId: string,
    answer: { answeredChoiceId: string; correct: boolean; answeredAt: string }
  ): Promise<void> {
    const recorded = await invoke<boolean>("record_delivery_answer", {
      deliveryId,
      answeredChoiceId: answer.answeredChoiceId,
      correct: answer.correct,
      answeredAt: answer.answeredAt
    });
    if (!recorded) {
      // Either the delivery is unknown or it already has an answer. The
      // command reports rather than overwriting, and so does this.
      throw new Error(`delivery "${deliveryId}" is unknown or already answered`);
    }
  }

  async find(query: DeliveryEventQuery = {}): Promise<DeliveryEvent[]> {
    if (query.sessionId) {
      return invoke<DeliveryEvent[]>("list_deliveries_for_session", { sessionId: query.sessionId });
    }
    if (!query.learnerRef) {
      // The ledger is large and per-learner by design; an unscoped read would
      // be a table scan that no caller actually needs.
      throw new Error("a delivery query needs either a learnerRef or a sessionId");
    }
    const events = await invoke<DeliveryEvent[]>("list_deliveries_for_learner", {
      learnerRef: query.learnerRef,
      since: query.since ?? null
    });
    return events.filter((event) => (query.conceptId ? event.conceptId === query.conceptId : true));
  }
}
