import { NextResponse } from "next/server";
import { pool } from "../../../../db/client";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const result = await pool.query(`
    SELECT current_database() AS database_name
  `);

  return NextResponse.json(result.rows[0]);
}
