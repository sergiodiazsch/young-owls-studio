import { NextResponse } from "next/server";
import { db, ensureSchema } from "@/lib/db";
import { sql, eq, desc } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { jsPDF } from "jspdf";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const projectId = Number(id);
    if (isNaN(projectId)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

    // Fetch project
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Fetch all stats in parallel
    const [
      sceneRows,
      characterRows,
      imageStats,
      videoStats,
      voiceStats,
      audioStats,
      dialogueCount,
    ] = await Promise.all([
      db.select().from(schema.scenes).where(eq(schema.scenes.projectId, projectId)).orderBy(schema.scenes.sceneNumber),
      db.select().from(schema.characters).where(eq(schema.characters.projectId, projectId)).orderBy(desc(schema.characters.dialogueCount)),
      db.select({
        total: sql<number>`COUNT(*)`,
        completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
      }).from(schema.imageGenerations).where(eq(schema.imageGenerations.projectId, projectId)).then(r => r[0]),
      db.select({
        total: sql<number>`COUNT(*)`,
        completed: sql<number>`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)`,
        totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
      }).from(schema.videoGenerations).where(eq(schema.videoGenerations.projectId, projectId)).then(r => r[0]),
      db.select({
        total: sql<number>`COUNT(*)`,
        totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
      }).from(schema.voiceGenerations).where(eq(schema.voiceGenerations.projectId, projectId)).then(r => r[0]),
      db.select({
        total: sql<number>`COUNT(*)`,
        totalCost: sql<number>`COALESCE(SUM(cost), 0)`,
      }).from(schema.audioStudioGenerations).where(eq(schema.audioStudioGenerations.projectId, projectId)).then(r => r[0]),
      db.select({ count: sql<number>`COUNT(*)` }).from(schema.dialogues)
        .where(sql`scene_id IN (SELECT id FROM scenes WHERE project_id = ${projectId})`)
        .then(r => r[0]?.count || 0),
    ]);

    // Word count + pages
    const wordCount = project.rawText ? project.rawText.split(/\s+/).filter(Boolean).length : 0;
    const estimatedPages = Math.round(wordCount / 250);

    const totalCost = Number(((imageStats?.totalCost || 0) + (videoStats?.totalCost || 0) + (voiceStats?.totalCost || 0) + (audioStats?.totalCost || 0)).toFixed(2));
    const exportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    // ── Build PDF ──
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 18;
    const contentW = pageW - margin * 2;
    let y = 0;

    function checkPage(needed: number) {
      if (y + needed > doc.internal.pageSize.getHeight() - 15) {
        doc.addPage();
        y = margin;
      }
    }

    // ────────── COVER PAGE ──────────
    doc.setFillColor(10, 10, 20);
    doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("YOUNG OWLS STUDIO", margin, 40);

    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("Production Report", margin, 58);

    doc.setFontSize(18);
    doc.setFont("helvetica", "normal");
    const titleLines = doc.splitTextToSize(project.title, contentW);
    doc.text(titleLines, margin, 78);

    if (project.subtitle) {
      doc.setFontSize(12);
      doc.setTextColor(180, 180, 200);
      doc.text(project.subtitle, margin, 78 + titleLines.length * 10 + 6);
    }

    doc.setFontSize(10);
    doc.setTextColor(140, 140, 160);
    doc.text(`Exported: ${exportDate}`, margin, doc.internal.pageSize.getHeight() - 25);

    // ────────── PAGE 2: PRODUCTION SUMMARY ──────────
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");
    y = margin;

    doc.setTextColor(30, 30, 40);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Production Summary", margin, y);
    y += 12;

    doc.setDrawColor(220, 220, 230);
    doc.line(margin, y, pageW - margin, y);
    y += 8;

    const summaryData = [
      ["Total Scenes", String(sceneRows.length)],
      ["Total Characters", String(characterRows.length)],
      ["Dialogue Lines", String(dialogueCount)],
      ["Estimated Pages", String(estimatedPages)],
      ["Word Count", wordCount.toLocaleString()],
      ["Total AI Cost", `$${totalCost.toFixed(2)}`],
      ["Images Generated", `${imageStats?.completed || 0} / ${imageStats?.total || 0}`],
      ["Videos Generated", `${videoStats?.completed || 0} / ${videoStats?.total || 0}`],
      ["Voice Generations", String(voiceStats?.total || 0)],
      ["Audio/SFX Generations", String(audioStats?.total || 0)],
      ["Project Created", new Date(project.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })],
    ];

    doc.setFontSize(10);
    for (const [label, value] of summaryData) {
      checkPage(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 110);
      doc.text(label, margin, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 40);
      doc.text(value, pageW - margin, y, { align: "right" });
      y += 7;
    }

    // ────────── COST BREAKDOWN TABLE ──────────
    y += 10;
    checkPage(50);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 40);
    doc.text("Cost Breakdown", margin, y);
    y += 10;

    // Table header
    doc.setFillColor(245, 245, 250);
    doc.rect(margin, y - 4, contentW, 8, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 90);
    doc.text("Asset Type", margin + 3, y);
    doc.text("Count", margin + contentW * 0.5, y, { align: "center" });
    doc.text("Cost (USD)", pageW - margin - 3, y, { align: "right" });
    y += 8;

    const costRows = [
      ["Images", String(imageStats?.total || 0), `$${(imageStats?.totalCost || 0).toFixed(2)}`],
      ["Videos", String(videoStats?.total || 0), `$${(videoStats?.totalCost || 0).toFixed(2)}`],
      ["Voice / TTS", String(voiceStats?.total || 0), `$${(voiceStats?.totalCost || 0).toFixed(2)}`],
      ["Audio / SFX", String(audioStats?.total || 0), `$${(audioStats?.totalCost || 0).toFixed(2)}`],
    ];

    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 60);
    doc.setFontSize(9);
    for (const [type, count, cost] of costRows) {
      checkPage(7);
      doc.text(type, margin + 3, y);
      doc.text(count, margin + contentW * 0.5, y, { align: "center" });
      doc.text(cost, pageW - margin - 3, y, { align: "right" });
      y += 7;
    }

    // Total row
    doc.setDrawColor(220, 220, 230);
    doc.line(margin, y - 2, pageW - margin, y - 2);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.text("Total", margin + 3, y);
    doc.text(`$${totalCost.toFixed(2)}`, pageW - margin - 3, y, { align: "right" });
    y += 12;

    // ────────── SCENE-BY-SCENE TABLE ──────────
    checkPage(30);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 40);
    doc.text("Scene-by-Scene Overview", margin, y);
    y += 10;

    // Table header
    doc.setFillColor(245, 245, 250);
    doc.rect(margin, y - 4, contentW, 8, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 90);
    doc.text("#", margin + 2, y);
    doc.text("Heading", margin + 10, y);
    doc.text("Location", margin + contentW * 0.55, y);
    doc.text("Time", pageW - margin - 3, y, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 60);
    doc.setFontSize(8);
    for (const scene of sceneRows) {
      checkPage(7);
      doc.text(String(scene.sceneNumber), margin + 2, y);
      const heading = doc.splitTextToSize(scene.heading, contentW * 0.42);
      doc.text(heading[0] || "", margin + 10, y);
      doc.text(doc.splitTextToSize(scene.location || "-", contentW * 0.25)[0] || "-", margin + contentW * 0.55, y);
      doc.text(scene.timeOfDay || "-", pageW - margin - 3, y, { align: "right" });
      y += 6;
    }

    // ────────── CHARACTER LIST ──────────
    y += 8;
    checkPage(30);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 40);
    doc.text("Characters", margin, y);
    y += 10;

    doc.setFillColor(245, 245, 250);
    doc.rect(margin, y - 4, contentW, 8, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 90);
    doc.text("Name", margin + 3, y);
    doc.text("Role", margin + contentW * 0.4, y);
    doc.text("Dialogue Lines", pageW - margin - 3, y, { align: "right" });
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 60);
    doc.setFontSize(9);
    for (const char of characterRows) {
      checkPage(7);
      doc.text(char.name, margin + 3, y);
      doc.text(char.role || "-", margin + contentW * 0.4, y);
      doc.text(String(char.dialogueCount), pageW - margin - 3, y, { align: "right" });
      y += 6;
    }

    // ── Generate filename and return ──
    const safeName = project.title.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 40);
    const dateStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename = `YoungOwls_${safeName}_ProductionReport_${dateStr}.pdf`;

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    logger.error("GET /api/projects/[id]/report error", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
