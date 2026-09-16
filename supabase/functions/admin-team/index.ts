import "@supabase/functions-js/edge-runtime.d.ts";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { getSiteUrl } from "../_shared/config.ts";
import {
  assertAllowedOrigin, handleError, HttpError, jsonResponse, optionsResponse, readJson,
} from "../_shared/http.ts";
import { getAdminClient } from "../_shared/supabase.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ROLES = new Set(["customer", "check_in_staff", "content_manager", "admin"]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_request", "Invalid team request");
  }
  return value as Record<string, unknown>;
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return optionsResponse(request);
      if (request.method !== "POST") throw new HttpError(405, "method_not_allowed", "Use POST");
      assertAllowedOrigin(request);
      const body = record(await readJson(request, 4_096));
      const action = body.action;
      if (action !== "list" && action !== "invite" && action !== "set_role") {
        throw new HttpError(400, "invalid_action", "Unknown team action");
      }
      const actor = await requireAdmin(request, `team:${action}`);
      const admin = getAdminClient();

      if (action === "list") {
        const { data, error } = await admin.rpc("admin_list_team", { p_actor: actor });
        if (error) throw error;
        return jsonResponse(request, { users: data ?? [] });
      }

      const role = body.role;
      if (typeof role !== "string" || !ROLES.has(role) || (action === "invite" && role === "customer")) {
        throw new HttpError(400, "invalid_role", "Choose a valid operational role");
      }

      if (action === "set_role") {
        const target = body.user_id;
        if (typeof target !== "string" || !UUID.test(target)) {
          throw new HttpError(400, "invalid_user", "Select a valid user");
        }
        const { data, error } = await admin.rpc("admin_set_role", {
          p_actor: actor, p_target: target, p_role: role,
        });
        if (error?.message.includes("SELF_ROLE_CHANGE_FORBIDDEN")) {
          throw new HttpError(400, "self_role_change", "You cannot change your own role");
        }
        if (error?.message.includes("USER_NOT_FOUND")) {
          throw new HttpError(404, "user_not_found", "User not found");
        }
        if (error) throw error;
        return jsonResponse(request, { user: data });
      }

      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
      if (!EMAIL.test(email) || email.length > 254 || fullName.length > 120) {
        throw new HttpError(400, "invalid_invitation", "Enter a valid email and name");
      }
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName },
        redirectTo: `${getSiteUrl()}/admin/login?invite=1`,
      });
      if (inviteError || !invited.user) {
        throw new HttpError(400, "invite_failed", inviteError?.message ?? "Invitation failed");
      }
      const { error: roleError } = await admin.rpc("admin_set_role", {
        p_actor: actor, p_target: invited.user.id, p_role: role,
      });
      if (roleError) {
        // Fail closed: the invited account stays a customer until an admin fixes it.
        throw new HttpError(500, "role_assignment_failed",
          "Invitation was sent, but role assignment failed. Check this user in Supabase before sharing access");
      }
      return jsonResponse(request, { invited: true, email, role }, 201);
    } catch (error) {
      return handleError(request, error);
    }
  },
};
