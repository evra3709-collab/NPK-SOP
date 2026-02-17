
import { jsPDF } from "jspdf";
import { MaintenanceReport } from "../types";

// 폰트 캐싱
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
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
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
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        credentials: 'omit'
      }, 4000);

      if (response.ok) {
        return await response.blob();
      }
    } catch (e) { }
  }
  throw new Error("폰트 로드 실패. 네트워크를 확인하세요.");
};

const getFontBase64 = async (): Promise<string> => {
  if (cachedFontBase64) return cachedFontBase64;
  const blob = await fetchFontWithFallback();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(blob);
  });
};

export const generatePDFReport = async (reports: MaintenanceReport | MaintenanceReport[]) => {
  try {
    const reportList = Array.isArray(reports) ? reports : [reports];
    if (reportList.length === 0) return;

    const fontBase64 = await getFontBase64();
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });

    const fontName = "NanumGothic";
    const fontFile = "NanumGothic-Regular.ttf";
    
    doc.addFileToVFS(fontFile, fontBase64);
    doc.addFont(fontFile, fontName, "normal");
    doc.setFont(fontName, "normal");

    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - (margin * 2);

    for (let i = 0; i < reportList.length; i++) {
      const report = reportList[i];
      if (i > 0) doc.addPage();
      
      let y = 0;

      // 1. 헤더 디자인
      doc.setFillColor(31, 41, 55); // Gray-800
      doc.rect(0, 0, pageWidth, 35, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text("설비 정비 완료 보고서", pageWidth / 2, 22, { align: "center" });

      doc.setTextColor(40, 40, 40);
      y = 45;

      // 2. 기본 정보 표(Table) 그리기
      const drawTable = (data: { label: string, value: string }[]) => {
        const rowHeight = 10;
        const labelWidth = 40;
        const valueWidth = contentWidth - labelWidth;

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.2);

        data.forEach((item) => {
          const wrappedText = doc.splitTextToSize(item.value || "-", valueWidth - 10);
          const dynamicRowHeight = Math.max(rowHeight, (wrappedText.length * 6) + 4);

          if (y + dynamicRowHeight > pageHeight - 20) {
            doc.addPage();
            y = 20;
          }

          doc.setFillColor(245, 247, 250);
          doc.rect(margin, y, labelWidth, dynamicRowHeight, 'F');
          doc.rect(margin, y, contentWidth, dynamicRowHeight, 'D');
          doc.line(margin + labelWidth, y, margin + labelWidth, y + dynamicRowHeight);

          doc.setFontSize(9);
          doc.setTextColor(80, 80, 80);
          doc.text(item.label, margin + 5, y + (dynamicRowHeight / 2) + 1, { baseline: 'middle' });

          doc.setFontSize(10);
          doc.setTextColor(20, 20, 20);
          doc.text(wrappedText, margin + labelWidth + 5, y + 6);

          y += dynamicRowHeight;
        });
      };

      const tableData = [
        { label: "통지번호", value: report.notificationNo },
        { label: "작업부서", value: report.workDept || "공무" },
        { label: "설비명칭", value: report.equipmentName },
        { label: "정비일시", value: `${report.failDate} ${report.failTime}` },
        { label: "고장발생경위", value: report.workContent }, // 명칭 변경
        { label: "고장원인", value: report.cause },
        { label: "조치사항", value: report.action },
        { label: "조치상태", value: report.isCompleted ? "완료" : "진행중" }
      ];

      drawTable(tableData);

      // 3. AI 분석 섹션
      if (report.aiInsights) {
        y += 10;
        if (y > pageHeight - 40) { doc.addPage(); y = 20; }
        
        doc.setDrawColor(99, 102, 241);
        doc.setFillColor(249, 250, 255);
        const aiLines = doc.splitTextToSize(report.aiInsights, contentWidth - 10);
        const boxHeight = (aiLines.length * 5) + 15;
        
        doc.rect(margin, y, contentWidth, boxHeight, 'FD');
        doc.setTextColor(79, 70, 229);
        doc.setFontSize(10);
        doc.text("전문가 기술 자문 (AI 분석)", margin + 5, y + 7);
        
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(9);
        doc.text(aiLines, margin + 5, y + 14);
        y += boxHeight + 10;
      }

      // 4. 첨부 파일 이미지 섹션
      const imageAttachments = report.attachments?.filter(a => a.type.startsWith('image/')) || [];
      if (imageAttachments.length > 0) {
        if (y > pageHeight - 30) { doc.addPage(); y = 20; }
        
        doc.setTextColor(31, 41, 55);
        doc.setFontSize(11);
        doc.text("현장 사진 첨부", margin, y);
        y += 5;

        const imgWidth = (contentWidth / 2) - 5;
        const imgHeight = 60;
        let xPos = margin;

        for (let j = 0; j < imageAttachments.length; j++) {
          const img = imageAttachments[j];
          if (j > 0 && j % 2 === 0) {
            xPos = margin;
            y += imgHeight + 10;
          }
          if (y + imgHeight > pageHeight - 20) {
            doc.addPage();
            y = 20;
            xPos = margin;
          }
          try {
            doc.addImage(img.data, 'JPEG', xPos, y, imgWidth, imgHeight);
            doc.setDrawColor(230, 230, 230);
            doc.rect(xPos, y, imgWidth, imgHeight, 'D');
          } catch (e) {
            console.error("이미지 삽입 실패:", e);
          }
          xPos += imgWidth + 10;
        }
        y += imgHeight + 15;
      }

      // 5. 하단 푸터
      const footerY = pageHeight - 15;
      doc.setTextColor(180, 180, 180);
      doc.setFontSize(8);
      doc.text(`출력 일시: ${new Date().toLocaleString('ko-KR')}`, margin, footerY);
      doc.text(`Page ${i + 1} of ${reportList.length} | NPK SOP System`, pageWidth - margin, footerY, { align: "right" });
    }

    const filename = reportList.length === 1 
      ? `정비보고서_${reportList[0].notificationNo}.pdf` 
      : `정비보고서_일괄다운로드_${new Date().toISOString().slice(0,10)}.pdf`;
      
    doc.save(filename);
  } catch (error: any) {
    console.error("PDF 생성 에러:", error);
    alert(`PDF 생성 에러: ${error.message}`);
  }
};
