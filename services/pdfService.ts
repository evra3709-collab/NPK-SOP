
import { jsPDF } from "jspdf";
import { MaintenanceReport } from "../types.ts";

let cachedFontBase64: string | null = null;
const FONT_SOURCES = [
  'https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Regular.ttf',
  'https://cdn.jsdelivr.net/gh/googlefonts/nanumgothic@main/fonts/NanumGothic-Regular.ttf',
  'https://github.com/googlefonts/nanumgothic/raw/main/fonts/NanumGothic-Regular.ttf'
];

const fetchWithTimeout = async (url: string, options = {}, timeout = 3000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

const fetchFontWithFallback = async (): Promise<Blob> => {
  for (const url of FONT_SOURCES) {
    try {
      const response = await fetchWithTimeout(url, { method: 'GET', mode: 'cors' }, 4000);
      if (response.ok) return await response.blob();
    } catch (e) { }
  }
  throw new Error("폰트 로드 실패");
};

const getFontBase64 = async (): Promise<string> => {
  if (cachedFontBase64) return cachedFontBase64;
  const blob = await fetchFontWithFallback();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(blob);
  });
};

export const generatePDFReport = async (reports: MaintenanceReport | MaintenanceReport[]) => {
  try {
    const reportList = Array.isArray(reports) ? reports : [reports];
    const fontBase64 = await getFontBase64();
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    doc.addFileToVFS("NanumGothic.ttf", fontBase64);
    doc.addFont("NanumGothic.ttf", "NanumGothic", "normal");
    doc.setFont("NanumGothic", "normal");

    reportList.forEach((report, i) => {
      if (i > 0) doc.addPage();
      doc.setFillColor(31, 41, 55);
      doc.rect(0, 0, 210, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text("설비 정비 완료 보고서", 105, 22, { align: "center" });
      
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(10);
      let y = 50;
      [
        ["통지번호", report.notificationNo],
        ["설비명칭", report.equipmentName],
        ["정비부서", report.workDept],
        ["정비일시", `${report.failDate} ${report.failTime}`],
        ["고장내용", report.workContent],
        ["고장원인", report.cause],
        ["조치사항", report.action]
      ].forEach(([label, val]) => {
        doc.text(`${label}: ${val || "-"}`, 20, y);
        y += 10;
      });
      
      if (report.aiInsights) {
        doc.setFontSize(11);
        doc.text("AI 기술 자문:", 20, y + 5);
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(report.aiInsights, 170);
        doc.text(lines, 20, y + 12);
      }
    });

    doc.save(`정비보고서_${Date.now()}.pdf`);
  } catch (error) { console.error(error); }
};
