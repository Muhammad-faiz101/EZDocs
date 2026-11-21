import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { ensureSeeded } from "@/db/seed";

export async function GET() {
  await ensureSeeded();
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ authenticated: false, admin: null });
  }
  return NextResponse.json({
    authenticated: true,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
  });
}
