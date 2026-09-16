import "@supabase/functions-js/edge-runtime.d.ts";
import { handleStaffGate } from "../_shared/ticket-gate.ts";

export default {
  fetch(request: Request): Promise<Response> {
    return handleStaffGate(request, "verify");
  },
};
