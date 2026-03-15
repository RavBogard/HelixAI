import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { updatedSpec } = await req.json();

    if (!updatedSpec) {
      return NextResponse.json({ error: "Missing updatedSpec" }, { status: 400 });
    }

    const { id: conversationId } = await params;

    // We store the mutated PresetSpec in the preset_blob column as JSONB.
    // This allows the user to leave the page and come back, and we can re-hydrate
    // the visualizer exactly as they left it.
    const { error: dbErr } = await supabase
      .from("conversations")
      .update({
        preset_blob: updatedSpec,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .eq("user_id", user.id); // Security: assure they own the row

    if (dbErr) {
      console.error("Failed to sync PresetSpec to DB:", dbErr);
      return NextResponse.json({ error: "Database update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Preset sync error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
