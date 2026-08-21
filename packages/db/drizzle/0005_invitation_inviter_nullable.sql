-- Job L — API-key-authenticated invitation creation has no backing user (api keys are
-- org-scoped, not user-scoped; see the `apikey` table in schema/auth.ts, which has no
-- user_id column at all), so invitation.inviter_id must allow NULL for invitations
-- created by a manage-scoped key rather than a signed-in session. `invited_by` is then
-- null in the API response for those invitations instead of a fabricated user.
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_inviter_id_fk";--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "inviter_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
