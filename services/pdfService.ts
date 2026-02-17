
import { jsPDF } from "jspdf";
import { MaintenanceReport } from "../types";

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

    for (let i = 0; i < reportList.length; i++) {
      const report = reportList[i];
      if (i > 0) doc.addPage();
      
      // 헤더 섹션
      doc.setFillColor(0, 71, 146); // NPK Blue
      doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.text("설비 정비 완료 보고서", 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.text(`출력일시: ${new Date().toLocaleString('ko-KR')}`, 105, 30, { align: "center" });

      // 표 레이아웃 설정
      const startY = 55;
      const margin = 15;
      const col1Width = 40;
      const col2Width = 140;
      const rowHeight = 12;

      doc.setTextColor(40, 40, 40);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);

      const drawTableRow = (y: number, label: string, value: string, height: number = rowHeight) => {
        doc.setFillColor(245, 247, 250);
        doc.rect(margin, y, col1Width, height, 'F');
        doc.rect(margin, y, col1Width, height);
        doc.rect(margin + col1Width, y, col2Width, height);
        doc.setFontSize(10);
        doc.text(label, margin + 5, y + (height/2) + 2);
        const val = value || "-";
        const splitText = doc.splitTextToSize(val, col2Width - 10);
        doc.text(splitText, margin + col1Width + 5, y + (height/2) + 1);
        return height;
      };

      let currentY = startY;
      currentY += drawTableRow(currentY, "통지번호", report.notificationNo);
      currentY += drawTableRow(currentY, "설비명칭", report.equipmentName);
      currentY += drawTableRow(currentY, "정비부서", report.workDept);
      currentY += drawTableRow(currentY, "정비일시", `${report.failDate} ${report.failTime}`);
      
      const contentHeight = Math.max(rowHeight * 1.5, doc.splitTextToSize(report.workContent || "", col2Width - 10).length * 5 + 5);
      currentY += drawTableRow(currentY, "고장내용", report.workContent, contentHeight);
      
      const causeHeight = Math.max(rowHeight * 1.5, doc.splitTextToSize(report.cause || "", col2Width - 10).length * 5 + 5);
      currentY += drawTableRow(currentY, "고장원인", report.cause, causeHeight);
      
      const actionHeight = Math.max(rowHeight * 1.5, doc.splitTextToSize(report.action || "", col2Width - 10).length * 5 + 5);
      currentY += drawTableRow(currentY, "조치사항", report.action, actionHeight);

      // AI 기술 자문 섹션
      if (report.aiInsights) {
        currentY += 10;
        doc.setFillColor(255, 255, 255); // 배경색 흰색으로 변경
        doc.setDrawColor(255, 198, 0);
        doc.setLineWidth(0.5);
        const aiTextLines = doc.splitTextToSize(report.aiInsights, 170);
        const boxHeight = aiTextLines.length * 5 + 15;
        doc.rect(margin, currentY, 180, boxHeight, 'FD');
        doc.setTextColor(0, 71, 146);
        doc.setFontSize(11);
        doc.text("■ AI 솔루션", margin + 5, currentY + 7); // 제목 변경
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(9);
        doc.text(aiTextLines, margin + 5, currentY + 15);
        currentY += boxHeight;
      }

      // 이미지 첨부 섹션
      if (report.attachments && report.attachments.length > 0) {
        currentY += 15;
        if (currentY > 250) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setTextColor(0, 71, 146);
        doc.setFontSize(12);
        doc.text("■ 현장 사진 (첨부 자료)", margin, currentY);
        currentY += 8;

        for (const attachment of report.attachments) {
          if (attachment.type.startsWith('image/')) {
            try {
              // 이미지 가로세로 비율 유지하며 삽입 (폭 180mm 기준)
              const imgWidth = 180;
              const imgHeight = 100; // 최대 높이 제한
              
              if (currentY + imgHeight > 280) {
                doc.addPage();
                currentY = 20;
              }
              
              doc.addImage(attachment.data, "JPEG", margin, currentY, imgWidth, imgHeight, undefined, 'FAST');
              doc.setDrawColor(230, 230, 230);
              doc.rect(margin, currentY, imgWidth, imgHeight); // 이미지 테두리
              currentY += imgHeight + 10;
            } catch (err) {
              console.error("이미지 삽입 실패:", err);
            }
          }
        }
      }

      // 하단 푸터
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.text("본 보고서는 NPK SOP AI 시스템에 의해 자동 생성되었습니다.", 105, 288, { align: "center" });
      doc.text(`Page ${i + 1}`, 190, 288, { align: "right" });
    }

    const fileName = reportList.length === 1 
      ? `정비보고서_${reportList[0].notificationNo}.pdf` 
      : `정비보고서_일괄출력_${Date.now()}.pdf`;
      
    doc.save(fileName);
  } catch (error) { 
    console.error("PDF 생성 오류:", error); 
    alert("PDF 생성 중 오류가 발생했습니다.");
  }
};
