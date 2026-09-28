import { FitnessReportData } from '../types';
import { calcBMI, bmiCategory } from '../math';

/**
 * Builds and downloads a structured PDF fitness report using jsPDF and jspdf-autotable.
 * Supports optional peer dependency dynamic import.
 */
export async function buildReportPdf(data: FitnessReportData, filename?: string): Promise<any> {
  const { user, foodLogs, activityLogs, streak = 0, earnedBadges = [] } = data;

  const jsPdfModule: any = await (Function('return import("jspdf")')() as Promise<any>);
  const jsPDF = jsPdfModule.default || jsPdfModule.jsPDF || jsPdfModule;
  const autoTableModule: any = await (Function('return import("jspdf-autotable")')() as Promise<any>);
  const autoTable = autoTableModule.default || autoTableModule;

  const doc: any = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Top header banner
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FitTrack AI - Member Summary Report', 14, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${today} | Member: ${user?.username || 'Valued Athlete'}`, 14, 22);

  // User Profile Grid
  let y = 36;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Athlete Metrics & Profile', 14, y);
  y += 5;

  const bmiVal = user?.weight && user?.height ? calcBMI(user.weight, user.height) : null;
  const bmiLabel = bmiVal ? `${bmiVal} (${bmiCategory(bmiVal)})` : 'N/A';

  const userTableBody = [
    [
      'Weight',
      user?.weight ? `${user.weight} kg` : 'N/A',
      'Daily Calorie Goal',
      `${user?.dailycaloriesintake || 2000} kcal`,
    ],
    [
      'Height',
      user?.height ? `${user.height} cm` : 'N/A',
      'Daily Burn Target',
      `${user?.dailycaloriesburned || 400} kcal`,
    ],
    [
      'BMI',
      bmiLabel,
      'Active Streak',
      streak > 0 ? `${streak} Days` : '0 Days',
    ],
  ];

  autoTable(doc, {
    startY: y,
    body: userTableBody,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 32 },
      1: { cellWidth: 45 },
      2: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 42 },
      3: { cellWidth: 50 },
    },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 8;

  // Food logs section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Nutrition History (${foodLogs.length} entries)`, 14, y);
  y += 4;

  const foodRows = foodLogs.slice(0, 50).map((l: any) => [
    l.date || l.createdAt ? new Date(l.date || l.createdAt).toLocaleDateString('en-CA') : '-',
    l.mealType || 'Meal',
    l.name || l.foodName || 'Food Item',
    `${l.calories ?? 0} kcal`,
    `${l.protein ?? 0}g`,
    `${l.carbs ?? 0}g`,
    `${l.fat ?? 0}g`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Meal', 'Food Name', 'Calories', 'Protein', 'Carbs', 'Fat']],
    body: foodRows.length > 0 ? foodRows : [['-', '-', 'No meal records found', '-', '-', '-', '-']],
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  y = doc.lastAutoTable.finalY + 8;

  // Activity logs section
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Activity & Workout History (${activityLogs.length} sessions)`, 14, y);
  y += 4;

  const actRows = activityLogs.slice(0, 50).map((l: any) => [
    l.date || l.createdAt ? new Date(l.date || l.createdAt).toLocaleDateString('en-CA') : '-',
    l.name || l.type || 'Workout',
    `${l.duration ?? 0} min`,
    `${l.calories ?? l.caloriesBurned ?? 0} kcal`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Activity', 'Duration', 'Calories Burned']],
    body: actRows.length > 0 ? actRows : [['-', 'No activity records found', '-', '-']],
    theme: 'striped',
    headStyles: { fillColor: [14, 165, 233], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 2 },
    margin: { left: 14, right: 14 },
  });

  const outFilename = filename || `fittrack-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(outFilename);
  return doc;
}
